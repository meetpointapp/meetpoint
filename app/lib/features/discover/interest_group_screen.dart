import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/catalog.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';
import '../profile/profile_widgets.dart';

// Faz 16: "İlgi alanı bazlı keşif". Salt kaydırma yerine ortak ilgiye göre bir vitrin: aynı
// LikeActionCard'ı ("Seni beğenenler" ekranıyla ortak) bir ızgarada gösterir — hızlı-tüketim
// hissi vermeyen, göz atılabilir bir keşif biçimi.
class InterestGroupScreen extends ConsumerStatefulWidget {
  const InterestGroupScreen({super.key, required this.interestId});
  final String interestId;

  @override
  ConsumerState<InterestGroupScreen> createState() => _InterestGroupScreenState();
}

class _InterestGroupScreenState extends ConsumerState<InterestGroupScreen> {
  Future<void> _respond(PublicProfile p, bool like) async {
    final l = AppLocalizations.of(context);
    try {
      final r = await ref.read(apiProvider).swipe(p.id, like ? 'like' : 'pass');
      ref.invalidate(interestGroupMembersProvider(widget.interestId));
      if (r.match) {
        ref.invalidate(conversationsProvider);
        if (mounted) showSnack(context, l.newMatchWith(p.displayName));
      }
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final members = ref.watch(interestGroupMembersProvider(widget.interestId));
    return Scaffold(
      appBar: AppBar(
        title: Text('${interestEmoji[widget.interestId] ?? ''} ${l.interestGroupName(widget.interestId)}'),
      ),
      body: members.when(
        loading: () => const ListSkeleton(rows: 4),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(interestGroupMembersProvider(widget.interestId))),
        data: (users) {
          if (users.isEmpty) {
            return CenteredMessage(icon: Icons.groups_2_outlined, text: l.interestGroupEmpty);
          }
          return GridView.builder(
            padding: const EdgeInsets.all(12),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 3 / 4.4,
            ),
            itemCount: users.length,
            itemBuilder: (_, i) => LikeActionCard(
              profile: users[i],
              onPass: () => _respond(users[i], false),
              onLike: () => _respond(users[i], true),
            ),
          );
        },
      ),
    );
  }
}
