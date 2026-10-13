import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/fx.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// Faz 23: "Doğruluk mu Cesaret mi" — keşfetten ya da bildirimden açılır. Her turda iki taraf da doğruluk ya da
// cesaret seçer, sunucu rastgele soru verir; ikisi de cevaplayınca cevaplar açılır ve sonraki tura geçilir.
// 10 turdan sonra oyun biter.
const _truthColor = Color(0xFF7C5CFF);
const _dareColor = Color(0xFFFF5A3C);

class TruthDareScreen extends ConsumerStatefulWidget {
  const TruthDareScreen({super.key, required this.gameId});
  final String gameId;

  @override
  ConsumerState<TruthDareScreen> createState() => _TruthDareScreenState();
}

class _TruthDareScreenState extends ConsumerState<TruthDareScreen> {
  TruthDareGame? _game;
  Object? _error;
  bool _busy = false;
  bool _justRevealed = false;
  final _answer = TextEditingController();
  StreamSubscription<RealtimeEvent>? _sub;

  @override
  void initState() {
    super.initState();
    _load();
    // Karşı taraf cevaplayınca anında güncellenir
    _sub = ref.read(realtimeProvider).events.listen((e) {
      if (e.name == 'game:update' && e.data is Map && (e.data as Map)['gameId'] == widget.gameId) _load(showReveal: true);
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    _answer.dispose();
    super.dispose();
  }

  Future<void> _load({bool showReveal = false}) async {
    try {
      final g = await ref.read(apiProvider).truthDareGame(widget.gameId);
      if (!mounted) return;
      setState(() {
        _justRevealed = showReveal && _game != null && g.history.length > _game!.history.length;
        _game = g;
        _error = null;
      });
      ref.invalidate(truthDareGamesProvider);
    } catch (e) {
      if (mounted && _game == null) setState(() => _error = e);
    }
  }

  Future<void> _run(Future<TruthDareGame> Function() action) async {
    if (_busy) return;
    final l = AppLocalizations.of(context);
    setState(() => _busy = true);
    try {
      final before = _game?.history.length ?? 0;
      final g = await action();
      if (!mounted) return;
      setState(() {
        _game = g;
        _justRevealed = g.history.length > before;
      });
      if (g.history.length > before) Fx.success();
      ref.invalidate(truthDareGamesProvider);
    } catch (e) {
      if (mounted) {
        showSnack(context, errorText(l, e));
        _load();
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _send() async {
    final text = _answer.text.trim();
    if (text.isEmpty) return;
    final before = _game?.current.index;
    await _run(() => ref.read(apiProvider).tdAnswer(widget.gameId, text));
    // Cevap alındıysa (bekleme ya da sonraki tur) kutu temizlenir; hata olduysa yazı korunur
    if (mounted && (_game?.current.mine.answered == true || _game?.current.index != before)) _answer.clear();
  }

  Future<void> _end() async {
    final l = AppLocalizations.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        content: Text(l.tdEndConfirm),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.cancel)),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(l.tdEndGame)),
        ],
      ),
    );
    if (ok == true) await _run(() => ref.read(apiProvider).tdEnd(widget.gameId));
  }

  Future<void> _report() async {
    final l = AppLocalizations.of(context);
    final reasons = {
      'harassment': l.reportHarassment,
      'inappropriate_content': l.reportInappropriate,
      'scam': l.reportScam,
      'other': l.reportOther,
    };
    final reason = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(title: Text(l.reportTitle, style: Theme.of(ctx).textTheme.titleMedium)),
          for (final e in reasons.entries) ListTile(title: Text(e.value), onTap: () => Navigator.pop(ctx, e.key)),
        ]),
      ),
    );
    if (reason == null || !mounted) return;
    try {
      await ref.read(apiProvider).tdReport(widget.gameId, reason);
      if (mounted) showSnack(context, l.reportSent);
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    }
  }

  Future<void> _playAgain() async {
    final g = _game;
    if (g == null) return;
    final l = AppLocalizations.of(context);
    try {
      final fresh = await ref.read(apiProvider).startTruthDare(g.other.id);
      if (mounted) context.pushReplacement('/game/${fresh.id}');
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final g = _game;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: g == null
            ? Text(l.truthDareTitle)
            : GestureDetector(
                onTap: () => context.push('/user/${g.other.id}'),
                child: Row(children: [
                  Avatar(g.other, radius: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      NameWithBadge(g.other.displayName,
                          verified: g.other.verified, premium: g.other.premium, badgeId: g.other.badgeId, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                      Text(l.truthDareTitle, style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                    ]),
                  ),
                ]),
              ),
        actions: [
          if (g != null && g.active)
            PopupMenuButton<String>(
              onSelected: (v) => v == 'end' ? _end() : _report(),
              itemBuilder: (_) => [
                PopupMenuItem(value: 'end', child: Text(l.tdEndGame)),
                PopupMenuItem(value: 'report', child: Text(l.postReport)),
              ],
            ),
        ],
      ),
      body: _error != null && g == null
          ? ErrorRetry(error: _error!, onRetry: _load)
          : g == null
              ? const ListSkeleton(rows: 3)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      _Progress(game: g),
                      const SizedBox(height: 14),
                      if (_justRevealed && g.history.isNotEmpty) ...[
                        _RevealBanner(text: l.tdRevealed),
                        const SizedBox(height: 10),
                      ],
                      if (g.active) _current(g, l, theme) else _closed(g, l, theme),
                      if (g.history.isNotEmpty) ...[
                        const SizedBox(height: 22),
                        Text(l.tdHistory, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                        const SizedBox(height: 10),
                        for (final r in g.history.reversed) ...[
                          _RoundCard(round: r, total: g.totalRounds, otherName: g.other.displayName, highlight: _justRevealed && r.index == g.history.last.index),
                          const SizedBox(height: 10),
                        ],
                      ],
                    ],
                  ),
                ),
    );
  }

  Widget _current(TruthDareGame g, AppLocalizations l, ThemeData theme) {
    final r = g.current;
    final mine = r.mine;
    final name = g.other.displayName;

    // 1) Seçim yok: doğruluk mu cesaret mi
    if (mine.choice.isEmpty) {
      return Card(
        margin: EdgeInsets.zero,
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(l.tdRoundOf(r.index, g.totalRounds), style: theme.textTheme.labelLarge?.copyWith(color: theme.colorScheme.onSurfaceVariant, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(l.tdChoose, style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
            if (r.theirs.answered || r.theirs.choice.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(r.theirs.answered ? l.tdOtherAnswered(name) : l.tdOtherChose(name), style: theme.textTheme.bodySmall?.copyWith(color: Brand.coral, fontWeight: FontWeight.w700)),
            ],
            const SizedBox(height: 16),
            Row(children: [
              Expanded(child: _ChoiceButton(label: l.tdTruth, hint: l.tdTruthHint, emoji: '🫣', color: _truthColor, busy: _busy, onTap: () => _run(() => ref.read(apiProvider).tdChoose(g.id, 'truth')))),
              const SizedBox(width: 12),
              Expanded(child: _ChoiceButton(label: l.tdDare, hint: l.tdDareHint, emoji: '🔥', color: _dareColor, busy: _busy, onTap: () => _run(() => ref.read(apiProvider).tdChoose(g.id, 'dare')))),
            ]),
          ]),
        ),
      );
    }

    final prompt = mine.prompt;
    final color = (prompt?.isTruth ?? true) ? _truthColor : _dareColor;

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (prompt != null)
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [color, Color.lerp(color, Colors.black, 0.28)!]),
            boxShadow: [BoxShadow(color: color.withValues(alpha: 0.35), blurRadius: 18, offset: const Offset(0, 8))],
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              _Pill(text: '${prompt.isTruth ? '🫣' : '🔥'} ${prompt.isTruth ? l.tdTruth : l.tdDare}'),
              const SizedBox(width: 8),
              _Pill(text: _toneLabel(l, prompt.tone)),
              const Spacer(),
              Text(l.tdRoundOf(r.index, g.totalRounds), style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w700, fontSize: 12.5)),
            ]),
            const SizedBox(height: 14),
            Text(prompt.text, style: const TextStyle(color: Colors.white, fontSize: 21, fontWeight: FontWeight.w800, height: 1.3)),
          ]),
        ),
      const SizedBox(height: 14),
      if (!mine.answered) ...[
        if (r.theirs.answered)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text(l.tdOtherAnswered(name), style: theme.textTheme.bodyMedium?.copyWith(color: Brand.coral, fontWeight: FontWeight.w800)),
          ),
        TextField(
          controller: _answer,
          minLines: 3,
          maxLines: 6,
          maxLength: 300,
          textCapitalization: TextCapitalization.sentences,
          decoration: InputDecoration(hintText: l.tdAnswerHint),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 10),
        GradientButton(label: l.tdSend, icon: Icons.send_rounded, busy: _busy, onPressed: _answer.text.trim().isEmpty ? null : _send),
      ] else
        Card(
          margin: EdgeInsets.zero,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                const Icon(Icons.check_circle_rounded, color: Brand.like),
                const SizedBox(width: 8),
                Text(l.tdWaiting, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
              ]),
              const SizedBox(height: 10),
              Text('“${mine.answer}”', style: theme.textTheme.bodyLarge?.copyWith(fontStyle: FontStyle.italic, height: 1.35)),
              const SizedBox(height: 10),
              Text(l.tdWaitingBody(name), style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
            ]),
          ),
        ),
    ]);
  }

  Widget _closed(TruthDareGame g, AppLocalizations l, ThemeData theme) {
    final name = g.other.displayName;
    final (emoji, title, body) = switch (g.state) {
      'FINISHED' => ('🎉', l.tdFinishedTitle, l.tdFinishedBody(name, g.totalRounds)),
      'DECLINED' => ('🙈', l.tdDeclined, l.tdClosedBody(name)),
      _ => ('🏁', l.tdEnded, l.tdClosedBody(name)),
    };
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(22),
        child: Column(children: [
          Text(emoji, style: const TextStyle(fontSize: 46)),
          const SizedBox(height: 8),
          Text(title, style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 6),
          Text(body, textAlign: TextAlign.center, style: theme.textTheme.bodyMedium),
          const SizedBox(height: 16),
          GradientButton(label: l.tdPlayAgain, icon: Icons.casino_rounded, onPressed: _playAgain),
          TextButton(onPressed: () => context.push('/user/${g.other.id}'), child: Text(l.viewProfile)),
        ]),
      ),
    );
  }
}

String _toneLabel(AppLocalizations l, String tone) => switch (tone) {
      'romantic' => '💕 ${l.tdToneRomantic}',
      'deep' => '🌙 ${l.tdToneDeep}',
      _ => '😄 ${l.tdToneFun}',
    };

class _Progress extends StatelessWidget {
  const _Progress({required this.game});
  final TruthDareGame game;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final done = game.history.length;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Text('🎲', style: theme.textTheme.titleLarge),
        const SizedBox(width: 8),
        Expanded(child: Text(l.truthDareTitle, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900))),
        Text('$done / ${game.totalRounds}', style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w800, color: Brand.coral)),
      ]),
      const SizedBox(height: 8),
      Row(children: [
        for (var i = 0; i < game.totalRounds; i++)
          Expanded(
            child: Container(
              height: 6,
              margin: EdgeInsets.only(right: i == game.totalRounds - 1 ? 0 : 4),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(3),
                gradient: i < done ? Brand.gradient : null,
                color: i < done ? null : theme.colorScheme.outlineVariant.withValues(alpha: 0.5),
              ),
            ),
          ),
      ]),
    ]);
  }
}

class _RevealBanner extends StatelessWidget {
  const _RevealBanner({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), gradient: Brand.gradient),
        child: Row(children: [
          const Text('👀', style: TextStyle(fontSize: 18)),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: TextStyle(color: Brand.onAccent, fontWeight: FontWeight.w900))),
        ]),
      );
}

class _Pill extends StatelessWidget {
  const _Pill({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(12)),
        child: Text(text, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12)),
      );
}

class _ChoiceButton extends StatelessWidget {
  const _ChoiceButton({required this.label, required this.hint, required this.emoji, required this.color, required this.busy, required this.onTap});
  final String label;
  final String hint;
  final String emoji;
  final Color color;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: label,
        excludeSemantics: true,
        onTap: busy ? null : onTap,
        child: GestureDetector(
          onTap: busy ? null : onTap,
          child: AnimatedOpacity(
            duration: const Duration(milliseconds: 150),
            opacity: busy ? 0.55 : 1,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 10),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [color, Color.lerp(color, Colors.black, 0.3)!]),
                boxShadow: [BoxShadow(color: color.withValues(alpha: 0.35), blurRadius: 14, offset: const Offset(0, 6))],
              ),
              child: Column(children: [
                Text(emoji, style: const TextStyle(fontSize: 34)),
                const SizedBox(height: 8),
                Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 17)),
                const SizedBox(height: 2),
                Text(hint, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70, fontSize: 11.5)),
              ]),
            ),
          ),
        ),
      );
}

// Açılmış bir turun iki tarafı: seçim, soru ve cevap
class _RoundCard extends StatelessWidget {
  const _RoundCard({required this.round, required this.total, required this.otherName, required this.highlight});
  final TdRound round;
  final int total;
  final String otherName;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    Widget side(String who, TdSide s) {
      final p = s.prompt;
      final color = (p?.isTruth ?? true) ? _truthColor : _dareColor;
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(14), border: Border.all(color: color.withValues(alpha: 0.35))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Flexible(child: Text(who, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w900))),
            const SizedBox(width: 8),
            Text(p == null ? '' : (p.isTruth ? '🫣 ${l.tdTruth}' : '🔥 ${l.tdDare}'), style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 12)),
          ]),
          if (p != null) ...[
            const SizedBox(height: 6),
            Text(p.text, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant, height: 1.3)),
          ],
          const SizedBox(height: 8),
          Text(s.answer, style: theme.textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w600, height: 1.35)),
        ]),
      );
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.cardTheme.color,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: highlight ? Brand.coral : theme.colorScheme.outlineVariant.withValues(alpha: 0.5), width: highlight ? 2 : 1),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(l.tdRoundOf(round.index, total), style: theme.textTheme.labelMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant, fontWeight: FontWeight.w800)),
        ),
        side(l.tdYou, round.mine),
        const SizedBox(height: 8),
        side(otherName, round.theirs),
      ]),
    );
  }
}
