import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import '../../core/models.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// Yardım ve destek: SSS (arama + kategoriler), destek talepleri (liste, yeni talep, yazışma)

final supportInboxProvider = FutureProvider.autoDispose<SupportInbox>((ref) => ref.watch(apiProvider).supportTickets());

final _helpProvider = FutureProvider.autoDispose.family<List<HelpCategory>, (String, String)>(
  (ref, key) => ref.watch(apiProvider).help(key.$1, query: key.$2),
);

final _ticketProvider = FutureProvider.autoDispose.family<SupportTicket, String>((ref, id) => ref.watch(apiProvider).supportTicket(id));

String supportCategoryLabel(AppLocalizations l, SupportCategory c) => switch (c) {
      SupportCategory.coins => l.supportCatCoins,
      SupportCategory.calls => l.supportCatCalls,
      SupportCategory.cashout => l.supportCatCashout,
      SupportCategory.safety => l.supportCatSafety,
      SupportCategory.account => l.supportCatAccount,
      SupportCategory.bug => l.supportCatBug,
      SupportCategory.suggestion => l.supportCatSuggestion,
      SupportCategory.other => l.supportCatOther,
    };

String get _platform => kIsWeb
    ? 'web'
    : switch (defaultTargetPlatform) {
        TargetPlatform.iOS => 'ios',
        _ => 'android',
      };

typedef NewTicketArgs = ({SupportCategory? category, RelatedRecord? related, String? relatedLabel});

// Yeni talep ekranını aç (ör. cüzdan hareketinden: işlem iliştirilmiş olarak)
Future<void> openNewTicket(BuildContext context, {SupportCategory? category, RelatedRecord? related, String? relatedLabel}) =>
    context.push('/support/new', extra: (category: category, related: related, relatedLabel: relatedLabel));

// ---------- Yardım merkezi ----------

class HelpCenterScreen extends ConsumerStatefulWidget {
  const HelpCenterScreen({super.key});

  @override
  ConsumerState<HelpCenterScreen> createState() => _HelpCenterScreenState();
}

class _HelpCenterScreenState extends ConsumerState<HelpCenterScreen> {
  final _search = TextEditingController();
  Timer? _debounce;
  String _query = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  void _onSearch(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () => setState(() => _query = v.trim()));
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final locale = ref.watch(localeProvider).languageCode;
    final help = ref.watch(_helpProvider((locale, _query)));
    final inbox = ref.watch(supportInboxProvider).value;

    return Scaffold(
      appBar: AppBar(title: Text(l.helpAndSupport)),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 24), children: [
        TextField(
          controller: _search,
          onChanged: _onSearch,
          textInputAction: TextInputAction.search,
          decoration: InputDecoration(
            hintText: l.helpSearchHint,
            prefixIcon: const Icon(Icons.search_rounded),
            suffixIcon: _search.text.isEmpty
                ? null
                : IconButton(
                    icon: const Icon(Icons.close_rounded),
                    tooltip: l.cancel,
                    onPressed: () {
                      _search.clear();
                      _onSearch('');
                    },
                  ),
          ),
        ),
        if (inbox != null && inbox.tickets.isNotEmpty) ...[
          const SizedBox(height: 12),
          Card(
            margin: EdgeInsets.zero,
            child: ListTile(
              leading: const Icon(Icons.forum_outlined),
              title: Text(l.myTickets),
              trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                if (inbox.unread > 0) Badge(label: Text('${inbox.unread}'), backgroundColor: Brand.coral),
                const Icon(Icons.chevron_right_rounded),
              ]),
              onTap: () => context.push('/support'),
            ),
          ),
        ],
        const SizedBox(height: 8),
        help.when(
          loading: () => const ListSkeleton(rows: 5),
          error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(_helpProvider((locale, _query)))),
          data: (cats) => cats.isEmpty
              ? Padding(
                  padding: const EdgeInsets.symmetric(vertical: 32),
                  child: Text(l.helpNoResults, textAlign: TextAlign.center, style: theme.textTheme.bodyMedium),
                )
              : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  for (final c in cats) ...[
                    Padding(
                      padding: const EdgeInsets.fromLTRB(4, 16, 4, 6),
                      child: Text('${c.icon}  ${c.title}', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                    ),
                    Card(
                      margin: EdgeInsets.zero,
                      clipBehavior: Clip.antiAlias,
                      child: Column(children: [
                        for (final (i, a) in c.articles.indexed) ...[
                          if (i > 0) const Divider(height: 1, indent: 16, endIndent: 16),
                          ExpansionTile(
                            // Aramada sonuçlar açık gelir
                            key: PageStorageKey('${a.id}-$_query'),
                            initiallyExpanded: _query.isNotEmpty,
                            shape: const Border(),
                            collapsedShape: const Border(),
                            title: Text(a.question, style: theme.textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w600)),
                            childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
                            expandedAlignment: Alignment.centerLeft,
                            children: [Text(a.answer, style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant))],
                          ),
                        ],
                      ]),
                    ),
                  ],
                ]),
        ),
        const SizedBox(height: 24),
        Text(l.helpStillNeed, textAlign: TextAlign.center, style: theme.textTheme.titleSmall),
        const SizedBox(height: 10),
        GradientButton(label: l.contactSupport, icon: Icons.support_agent_rounded, onPressed: () => openNewTicket(context)),
        const SizedBox(height: 6),
        Center(
          child: TextButton(onPressed: () => openLegal('imprint', locale), child: Text(l.imprint)),
        ),
      ]),
    );
  }
}

// ---------- Taleplerim ----------

class SupportTicketsScreen extends ConsumerWidget {
  const SupportTicketsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final inbox = ref.watch(supportInboxProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.myTickets)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => openNewTicket(context),
        icon: const Icon(Icons.add_rounded),
        label: Text(l.newTicket),
      ),
      body: inbox.when(
        loading: () => const ListSkeleton(rows: 4),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(supportInboxProvider)),
        data: (box) => box.tickets.isEmpty
            ? CenteredMessage(icon: Icons.forum_outlined, text: l.noTickets)
            : RefreshIndicator(
                onRefresh: () => ref.refresh(supportInboxProvider.future),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                  itemCount: box.tickets.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (_, i) => _TicketTile(ticket: box.tickets[i]),
                ),
              ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip(this.status);
  final TicketStatus status;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final (label, color) = switch (status) {
      TicketStatus.open => (l.ticketOpen, scheme.onSurfaceVariant),
      TicketStatus.answered => (l.ticketAnswered, const Color(0xFF1FA463)),
      TicketStatus.closed => (l.ticketClosed, scheme.outline),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: ShapeDecoration(shape: const StadiumBorder(), color: color.withValues(alpha: 0.12)),
      child: Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700)),
    );
  }
}

class _TicketTile extends ConsumerWidget {
  const _TicketTile({required this.ticket});
  final SupportTicket ticket;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Card(
      margin: EdgeInsets.zero,
      child: ListTile(
        contentPadding: const EdgeInsets.fromLTRB(16, 6, 12, 6),
        title: Row(children: [
          if (ticket.unread) ...[
            Container(width: 8, height: 8, decoration: const BoxDecoration(shape: BoxShape.circle, color: Brand.coral)),
            const SizedBox(width: 6),
          ],
          Expanded(
            child: Text(ticket.subject,
                maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: ticket.unread ? FontWeight.w800 : FontWeight.w600)),
          ),
        ]),
        subtitle: Text('${supportCategoryLabel(l, ticket.category)} · ${DateFormat.yMMMd(l.localeName).format(ticket.lastMessageAt)}',
            style: theme.textTheme.bodySmall),
        trailing: _StatusChip(ticket.status),
        onTap: () async {
          await context.push('/support/${ticket.id}');
          ref.invalidate(supportInboxProvider);
        },
      ),
    );
  }
}

// ---------- Yeni talep ----------

class NewTicketScreen extends ConsumerStatefulWidget {
  const NewTicketScreen({super.key, this.args});
  final NewTicketArgs? args;

  @override
  ConsumerState<NewTicketScreen> createState() => _NewTicketScreenState();
}

class _NewTicketScreenState extends ConsumerState<NewTicketScreen> {
  final _subject = TextEditingController();
  final _body = TextEditingController();
  late SupportCategory? _category = widget.args?.category;
  late RelatedRecord? _related = widget.args?.related;
  XFile? _shot;
  Uint8List? _shotBytes;
  bool _busy = false;

  @override
  void dispose() {
    _subject.dispose();
    _body.dispose();
    super.dispose();
  }

  bool get _valid => _category != null && _subject.text.trim().length >= 3 && _body.text.trim().length >= 10;

  Future<void> _pick() async {
    final file = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1600, imageQuality: 85);
    if (file == null) return;
    final bytes = await file.readAsBytes();
    setState(() {
      _shot = file;
      _shotBytes = bytes;
    });
  }

  Future<void> _submit() async {
    final l = AppLocalizations.of(context);
    setState(() => _busy = true);
    try {
      final t = await ref.read(apiProvider).openSupportTicket(
            category: _category!,
            subject: _subject.text.trim(),
            body: _body.text.trim(),
            related: _related,
            screenshot: _shot,
            platform: _platform,
          );
      ref.invalidate(supportInboxProvider);
      if (!mounted) return;
      showSnack(context, l.ticketSent);
      context.pushReplacement('/support/${t.id}');
    } catch (e) {
      if (mounted) {
        showSnack(context, errorText(l, e));
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l.newTicket)),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 24), children: [
        Text(l.ticketCategory, style: theme.textTheme.titleSmall),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final c in SupportCategory.values)
            ChoiceChip(
              label: Text(supportCategoryLabel(l, c)),
              selected: _category == c,
              onSelected: _busy ? null : (_) => setState(() => _category = c),
            ),
        ]),
        const SizedBox(height: 16),
        TextField(
          controller: _subject,
          maxLength: 120,
          textCapitalization: TextCapitalization.sentences,
          decoration: InputDecoration(hintText: l.ticketSubject, counterText: ''),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _body,
          minLines: 5,
          maxLines: 10,
          maxLength: 4000,
          textCapitalization: TextCapitalization.sentences,
          decoration: InputDecoration(hintText: l.ticketBodyHint),
          onChanged: (_) => setState(() {}),
        ),
        // İliştirilmiş işlem (cüzdan hareketinden gelindiyse)
        if (_related != null) ...[
          const SizedBox(height: 4),
          InputChip(
            avatar: const Icon(Icons.receipt_long_rounded, size: 18),
            label: Text(widget.args?.relatedLabel ?? l.relatedRecord),
            onDeleted: _busy ? null : () => setState(() => _related = null),
          ),
        ],
        const SizedBox(height: 8),
        if (_shotBytes == null)
          OutlinedButton.icon(onPressed: _busy ? null : _pick, icon: const Icon(Icons.add_photo_alternate_outlined), label: Text(l.addScreenshot))
        else
          Row(children: [
            ClipRRect(borderRadius: BorderRadius.circular(10), child: Image.memory(_shotBytes!, width: 64, height: 84, fit: BoxFit.cover)),
            const SizedBox(width: 12),
            Expanded(child: Text(l.screenshotAttached, style: theme.textTheme.bodyMedium)),
            IconButton(
              tooltip: l.remove,
              icon: const Icon(Icons.close_rounded),
              onPressed: _busy
                  ? null
                  : () => setState(() {
                        _shot = null;
                        _shotBytes = null;
                      }),
            ),
          ]),
        const SizedBox(height: 8),
        Text(l.ticketResponseTime, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
        const SizedBox(height: 16),
        GradientButton(label: l.send, icon: Icons.send_rounded, busy: _busy, onPressed: _valid ? _submit : null),
      ]),
    );
  }
}

// ---------- Talep yazışması ----------

class TicketScreen extends ConsumerStatefulWidget {
  const TicketScreen({super.key, required this.ticketId});
  final String ticketId;

  @override
  ConsumerState<TicketScreen> createState() => _TicketScreenState();
}

class _TicketScreenState extends ConsumerState<TicketScreen> {
  final _reply = TextEditingController();
  XFile? _shot;
  bool _busy = false;

  @override
  void dispose() {
    _reply.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final l = AppLocalizations.of(context);
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).replySupport(widget.ticketId, _reply.text.trim(), screenshot: _shot);
      _reply.clear();
      _shot = null;
      ref.invalidate(_ticketProvider(widget.ticketId));
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _close() async {
    final l = AppLocalizations.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l.closeTicket),
        content: Text(l.closeTicketConfirm),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.cancel)),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(l.closeTicket)),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(apiProvider).closeSupportTicket(widget.ticketId);
      ref.invalidate(_ticketProvider(widget.ticketId));
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    }
  }

  Future<void> _showAttachment(String messageId) async {
    final l = AppLocalizations.of(context);
    try {
      final bytes = await ref.read(apiProvider).supportAttachment(messageId);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (ctx) => Dialog(
          clipBehavior: Clip.antiAlias,
          child: InteractiveViewer(child: Image.memory(bytes)),
        ),
      );
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final ticket = ref.watch(_ticketProvider(widget.ticketId));
    final t = ticket.value;

    return Scaffold(
      appBar: AppBar(
        title: Text(t?.subject ?? l.supportTicket, maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: [
          if (t != null && t.status != TicketStatus.closed)
            PopupMenuButton<String>(
              onSelected: (_) => _close(),
              itemBuilder: (_) => [PopupMenuItem(value: 'close', child: Text(l.closeTicket))],
            ),
        ],
      ),
      body: ticket.when(
        loading: () => const ListSkeleton(rows: 3),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(_ticketProvider(widget.ticketId))),
        data: (t) => Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
            child: Row(children: [
              Text(supportCategoryLabel(l, t.category), style: theme.textTheme.bodySmall),
              const Spacer(),
              _StatusChip(t.status),
            ]),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.refresh(_ticketProvider(widget.ticketId).future),
              child: ListView(padding: const EdgeInsets.all(16), children: [
                for (final m in t.messages) _Bubble(message: m, onAttachment: () => _showAttachment(m.id)),
                if (t.status == TicketStatus.open)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(l.ticketWaiting, textAlign: TextAlign.center, style: theme.textTheme.bodySmall),
                  ),
              ]),
            ),
          ),
          if (t.status == TicketStatus.closed)
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Text(l.ticketClosedNote, textAlign: TextAlign.center, style: theme.textTheme.bodySmall),
                  TextButton(onPressed: () => openNewTicket(context, category: t.category), child: Text(l.newTicket)),
                ]),
              ),
            )
          else
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(8, 4, 8, 8),
                child: Row(children: [
                  IconButton(
                    tooltip: l.addScreenshot,
                    icon: Icon(_shot == null ? Icons.add_photo_alternate_outlined : Icons.image_rounded, color: _shot == null ? null : Brand.coral),
                    onPressed: _busy
                        ? null
                        : () async {
                            final f = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1600, imageQuality: 85);
                            if (f != null) setState(() => _shot = f);
                          },
                  ),
                  Expanded(
                    child: TextField(
                      controller: _reply,
                      minLines: 1,
                      maxLines: 4,
                      maxLength: 4000,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: InputDecoration(hintText: l.writeReply, counterText: '', isDense: true),
                      onChanged: (_) => setState(() {}),
                    ),
                  ),
                  IconButton.filled(
                    tooltip: l.send,
                    onPressed: _busy || _reply.text.trim().isEmpty ? null : _send,
                    icon: _busy
                        ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.send_rounded),
                  ),
                ]),
              ),
            ),
        ]),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message, required this.onAttachment});
  final SupportMessage message;
  final VoidCallback onAttachment;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final mine = !message.fromStaff;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.82),
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(Brand.radius),
            color: mine ? Brand.coral.withValues(alpha: 0.12) : theme.colorScheme.surfaceContainerHighest,
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (!mine)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.support_agent_rounded, size: 16, color: Brand.coral),
                  const SizedBox(width: 4),
                  Text(l.supportTeam, style: theme.textTheme.labelMedium?.copyWith(color: Brand.coral, fontWeight: FontWeight.w800)),
                ]),
              ),
            SelectableText(message.body, style: theme.textTheme.bodyMedium),
            if (message.hasAttachment)
              TextButton.icon(
                style: TextButton.styleFrom(padding: EdgeInsets.zero, visualDensity: VisualDensity.compact),
                onPressed: onAttachment,
                icon: const Icon(Icons.image_outlined, size: 18),
                label: Text(l.viewScreenshot),
              ),
            const SizedBox(height: 2),
            Text(DateFormat.yMMMd(l.localeName).add_Hm().format(message.createdAt),
                style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          ]),
        ),
      ),
    );
  }
}
