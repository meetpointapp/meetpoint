import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import 'models.dart';
import 'share_card.dart';
import 'theme.dart';
import 'ui.dart';

// Faz 17 madde 9: paylaşılabilir anlar — eşleşme, profil ve vibe kartı için "kendi şablonumuz"
// (ShareTemplate, bkz. share_card.dart). Dış bir tasarım/servis kullanılmaz.

Widget _framedPhoto(String? url, double angle) => Transform.rotate(
      angle: angle,
      child: Container(
        width: 150,
        height: 195,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.white, width: 4),
          boxShadow: const [BoxShadow(color: Colors.black38, blurRadius: 14)],
        ),
        child: ClipRRect(borderRadius: BorderRadius.circular(14), child: NetPhoto(url, width: 150, height: 195)),
      ),
    );

Widget matchShareCard(AppLocalizations l, PublicProfile? me, PublicProfile other) => ShareTemplate(
      hero: SizedBox(
        height: 250,
        width: 320,
        child: Stack(alignment: Alignment.center, children: [
          Positioned(left: 0, child: _framedPhoto(me?.coverThumbUrl, -0.1)),
          Positioned(right: 0, child: _framedPhoto(other.coverThumbUrl, 0.1)),
          Container(
            width: 56,
            height: 56,
            decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white),
            child: Icon(Icons.favorite_rounded, color: Brand.coral, size: 30),
          ),
        ]),
      ),
      title: l.shareMatchTitle,
      subtitle: l.shareMatchWith(other.displayName),
    );

Widget profileShareCard(AppLocalizations l, PublicProfile p) => ShareTemplate(
      hero: Container(
        width: 220,
        height: 220,
        decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 5)),
        child: ClipOval(child: NetPhoto(p.coverThumbUrl, width: 220, height: 220)),
      ),
      title: '${p.displayName}, ${p.age}',
      subtitle: l.shareProfileTagline,
    );

Widget vibeShareCard(AppLocalizations l, String archetypeId) => ShareTemplate(
      hero: Container(
        width: 140,
        height: 140,
        decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white),
        child: Icon(Icons.auto_awesome_rounded, color: Brand.coral, size: 64),
      ),
      title: l.vibeArchetypeName(archetypeId),
      subtitle: l.vibeArchetypeDesc(archetypeId),
    );

// Faz 22: gönderi kartı — yazı büyük ve okunur, altta yazar ve marka
Widget postShareCard(AppLocalizations l, Post post) => ShareTemplate(
      hero: Container(
        width: 400,
        padding: const EdgeInsets.fromLTRB(26, 22, 26, 26),
        decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.16), borderRadius: BorderRadius.circular(30)),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Icon(Icons.format_quote_rounded, color: Colors.white70, size: 46),
          Text(
            post.body,
            maxLines: 9,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: Colors.white, fontSize: 25, fontWeight: FontWeight.w700, height: 1.3),
          ),
        ]),
      ),
      title: post.author.displayName,
      subtitle: l.sharePostSubtitle,
    );
