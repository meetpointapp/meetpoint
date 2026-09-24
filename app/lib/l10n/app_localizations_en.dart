// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'MeetPoint';

  @override
  String get tagline => 'Meet, talk, earn.';

  @override
  String get loginTitle => 'Welcome back';

  @override
  String get registerTitle => 'Create account';

  @override
  String get email => 'Email';

  @override
  String get password => 'Password';

  @override
  String get passwordHint => 'At least 8 characters';

  @override
  String get login => 'Log in';

  @override
  String get register => 'Sign up';

  @override
  String get noAccount => 'No account? Sign up';

  @override
  String get haveAccount => 'Already have an account? Log in';

  @override
  String get setupTitle => 'Create your profile';

  @override
  String get editProfile => 'Edit profile';

  @override
  String get photos => 'Photos';

  @override
  String photosHint(int max) {
    return 'At least 1, up to $max photos. Your first photo is your cover.';
  }

  @override
  String get displayName => 'Display name';

  @override
  String get birthDate => 'Date of birth';

  @override
  String get selectDate => 'Select date';

  @override
  String get gender => 'Gender';

  @override
  String get male => 'Man';

  @override
  String get female => 'Woman';

  @override
  String get other => 'Other';

  @override
  String get interestedIn => 'Interested in';

  @override
  String get men => 'Men';

  @override
  String get women => 'Women';

  @override
  String get everyone => 'Everyone';

  @override
  String get bio => 'About me';

  @override
  String get city => 'City';

  @override
  String get country => 'Country';

  @override
  String get save => 'Save';

  @override
  String get continueLabel => 'Continue';

  @override
  String get requiredField => 'This field is required';

  @override
  String get photoRequired => 'Add at least one photo';

  @override
  String get saved => 'Saved';

  @override
  String get navDiscover => 'Discover';

  @override
  String get navRequests => 'Requests';

  @override
  String get navChats => 'Chats';

  @override
  String get navWallet => 'Wallet';

  @override
  String get navProfile => 'Profile';

  @override
  String get noMoreProfiles => 'No one new around right now';

  @override
  String get refresh => 'Refresh';

  @override
  String get itsAMatch => 'It\'s a match!';

  @override
  String matchBody(String name) {
    return 'You and $name liked each other. You can now chat for free.';
  }

  @override
  String get sendMessage => 'Send message';

  @override
  String get keepSwiping => 'Keep swiping';

  @override
  String get messageRequest => 'Message request';

  @override
  String get voiceCall => 'Voice call';

  @override
  String get videoCall => 'Video call';

  @override
  String coins(int count) {
    return '$count coins';
  }

  @override
  String requestDialogTitle(String name) {
    return 'Message request to $name';
  }

  @override
  String get requestDialogHint => 'Write your first message...';

  @override
  String requestCostInfo(int price) {
    return '$price coins will be held. If accepted they go to the recipient; if declined or unanswered within 24 hours they are refunded to you.';
  }

  @override
  String confirmRequestTitle(String kind) {
    return 'Send a $kind request?';
  }

  @override
  String get send => 'Send';

  @override
  String get cancel => 'Cancel';

  @override
  String get requestSent => 'Request sent';

  @override
  String get topUp => 'Top up';

  @override
  String get inbox => 'Received';

  @override
  String get outbox => 'Sent';

  @override
  String get noRequests => 'No requests yet';

  @override
  String get accept => 'Accept';

  @override
  String get reject => 'Decline';

  @override
  String get cancelRequest => 'Withdraw';

  @override
  String get statusPending => 'Pending';

  @override
  String get statusAccepted => 'Accepted';

  @override
  String get statusRejected => 'Declined';

  @override
  String get statusCancelled => 'Withdrawn';

  @override
  String get statusExpired => 'Expired';

  @override
  String expiresIn(int hours) {
    return 'Expires in ${hours}h';
  }

  @override
  String earnOnAccept(int price) {
    return 'Accept to earn +$price coins';
  }

  @override
  String get callComingSoon =>
      'Calling is coming soon. The coins were added to your balance.';

  @override
  String get noChats =>
      'No chats yet. Like someone in Discover or send a message request.';

  @override
  String get typeMessage => 'Type a message...';

  @override
  String get matchedChat => 'Match';

  @override
  String get requestChat => 'Message request';

  @override
  String get balance => 'Balance';

  @override
  String get cashable => 'Withdrawable';

  @override
  String get cashableInfo =>
      'Earnings paid to you with purchased coins can be cashed out.';

  @override
  String get cashout => 'Withdraw';

  @override
  String get comingSoon => 'Coming soon';

  @override
  String get buyCoins => 'Buy coins';

  @override
  String get testModeNote =>
      'Test mode: no payment is taken, coins are added instantly.';

  @override
  String get history => 'Activity';

  @override
  String get noHistory => 'No activity yet';

  @override
  String get txPurchase => 'Coin purchase';

  @override
  String get txHold => 'Held for request';

  @override
  String get txRefund => 'Refund';

  @override
  String get txEarn => 'Earnings';

  @override
  String get txSpend => 'Spent';

  @override
  String get txCashout => 'Withdrawal';

  @override
  String get txGrant => 'Bonus';

  @override
  String coinsAdded(int count) {
    return '$count coins added';
  }

  @override
  String get language => 'Language';

  @override
  String get logout => 'Log out';

  @override
  String get block => 'Block';

  @override
  String get report => 'Report';

  @override
  String blockConfirm(String name) {
    return 'Block $name? They won\'t be able to see or contact you.';
  }

  @override
  String get blocked => 'Blocked';

  @override
  String get reportTitle => 'Reason for report';

  @override
  String get reportFake => 'Fake profile';

  @override
  String get reportInappropriate => 'Inappropriate content';

  @override
  String get reportHarassment => 'Harassment';

  @override
  String get reportScam => 'Scam';

  @override
  String get reportUnderage => 'Underage';

  @override
  String get reportOther => 'Other';

  @override
  String get reportSent => 'Thanks, your report was received.';

  @override
  String get errGeneric => 'Something went wrong. Please try again.';

  @override
  String get errNetwork => 'Couldn\'t reach the server.';

  @override
  String get errInvalidCredentials => 'Wrong email or password.';

  @override
  String get errEmailTaken => 'This email is already registered.';

  @override
  String get errUnderage => 'You must be 18 or older to use MeetPoint.';

  @override
  String get errInsufficientBalance => 'You don\'t have enough coins.';

  @override
  String get errAlreadyPending =>
      'You already have a pending request with this person.';

  @override
  String get errAlreadyInConversation =>
      'You already have a chat with this person.';

  @override
  String get errTooManyPhotos => 'You can add up to 6 photos.';

  @override
  String get errValidation => 'Please check your details.';

  @override
  String get errExpired => 'This request has expired.';

  @override
  String get errNotPending => 'This request is no longer active.';

  @override
  String get errBlocked => 'You can no longer message this person.';

  @override
  String interestLabel(String id) {
    String _temp0 = intl.Intl.selectLogic(id, {
      'coffee': 'Coffee',
      'travel': 'Travel',
      'music': 'Music',
      'concerts': 'Concerts',
      'movies': 'Movies',
      'series': 'TV series',
      'books': 'Books',
      'photography': 'Photography',
      'art': 'Art',
      'cooking': 'Cooking',
      'foodie': 'Foodie',
      'wine': 'Wine',
      'fitness': 'Fitness',
      'yoga': 'Yoga',
      'running': 'Running',
      'cycling': 'Cycling',
      'hiking': 'Hiking',
      'camping': 'Camping',
      'football': 'Football',
      'basketball': 'Basketball',
      'gaming': 'Gaming',
      'tech': 'Tech',
      'fashion': 'Fashion',
      'dancing': 'Dancing',
      'pets': 'Pets',
      'nature': 'Nature',
      'beach': 'Beach',
      'meditation': 'Meditation',
      'anime': 'Anime',
      'volunteering': 'Volunteering',
      'other': '$id',
    });
    return '$_temp0';
  }

  @override
  String promptQuestion(String id) {
    String _temp0 = intl.Intl.selectLogic(id, {
      'perfect_sunday': 'My perfect Sunday...',
      'laugh': 'What makes me laugh the most...',
      'green_flag': 'A green flag I look for...',
      'travel_dream': 'My dream trip...',
      'unpopular_opinion': 'My unpopular opinion...',
      'simple_pleasures': 'My simple pleasures...',
      'looking_for': 'I\'m looking for someone who...',
      'two_truths': 'Two truths and a lie...',
      'first_date': 'The ideal first date...',
      'song': 'The song stuck in my head...',
      'other': '$id',
    });
    return '$_temp0';
  }

  @override
  String lookingForLabel(String id) {
    String _temp0 = intl.Intl.selectLogic(id, {
      'relationship': 'A relationship',
      'casual': 'Something casual',
      'friendship': 'New friends',
      'chat': 'Just chatting',
      'unsure': 'Not sure yet',
      'other': '$id',
    });
    return '$_temp0';
  }

  @override
  String educationLabel(String id) {
    String _temp0 = intl.Intl.selectLogic(id, {
      'high_school': 'High school',
      'bachelor': 'Bachelor\'s',
      'master': 'Master\'s',
      'phd': 'PhD',
      'other': '$id',
    });
    return '$_temp0';
  }

  @override
  String zodiacLabel(String id) {
    String _temp0 = intl.Intl.selectLogic(id, {
      'aries': 'Aries',
      'taurus': 'Taurus',
      'gemini': 'Gemini',
      'cancer': 'Cancer',
      'leo': 'Leo',
      'virgo': 'Virgo',
      'libra': 'Libra',
      'scorpio': 'Scorpio',
      'sagittarius': 'Sagittarius',
      'capricorn': 'Capricorn',
      'aquarius': 'Aquarius',
      'pisces': 'Pisces',
      'other': '$id',
    });
    return '$_temp0';
  }

  @override
  String habitLabel(String id) {
    String _temp0 = intl.Intl.selectLogic(id, {
      'no': 'No',
      'sometimes': 'Sometimes',
      'yes': 'Yes',
      'other': '$id',
    });
    return '$_temp0';
  }

  @override
  String get obNameTitle => 'What\'s your first name?';

  @override
  String get obNameHint => 'This is how it\'ll appear on your profile.';

  @override
  String get obBirthTitle => 'When\'s your birthday?';

  @override
  String get obBirthHint => 'Only your age is shown on your profile.';

  @override
  String obAgeLabel(int age) {
    return 'You\'re $age';
  }

  @override
  String get obGenderTitle => 'How do you identify?';

  @override
  String get obInterestedTitle => 'Who would you like to meet?';

  @override
  String get obPhotosTitle => 'Add your photos';

  @override
  String get obPhotosHint =>
      'At least 1 photo is required. Profiles with 3+ photos get more matches.';

  @override
  String get obInterestsTitle => 'What are you into?';

  @override
  String obInterestsHint(int min, int max) {
    return 'Pick $min to $max';
  }

  @override
  String get obLookingTitle => 'What are you looking for?';

  @override
  String get obPromptsTitle => 'Tell people about you';

  @override
  String get obPromptsHint =>
      'Pick up to 3 prompts and answer them. The easiest way to start a conversation.';

  @override
  String get obBasicsTitle => 'A few more details';

  @override
  String get obBasicsHint => 'All optional. You can change them any time.';

  @override
  String get skip => 'Skip';

  @override
  String get finish => 'Create my profile';

  @override
  String get addPrompt => 'Add a prompt';

  @override
  String get choosePrompt => 'Choose a prompt';

  @override
  String get yourAnswer => 'Your answer';

  @override
  String get height => 'Height';

  @override
  String heightCm(int cm) {
    return '$cm cm';
  }

  @override
  String get job => 'Job';

  @override
  String get education => 'Education';

  @override
  String get zodiac => 'Zodiac';

  @override
  String get smoking => 'Smoking';

  @override
  String get drinking => 'Drinking';

  @override
  String get lookingFor => 'Looking for';

  @override
  String get interests => 'Interests';

  @override
  String get prompts => 'Prompts';

  @override
  String get basics => 'Basics';

  @override
  String get notSpecified => 'Not specified';

  @override
  String get makeCover => 'Set as cover photo';

  @override
  String get deletePhoto => 'Delete photo';

  @override
  String get cover => 'Cover';

  @override
  String get edit => 'Edit';

  @override
  String get personalInfo => 'Personal info';

  @override
  String profileCompletion(int percent) {
    return 'Your profile is $percent% complete';
  }

  @override
  String commonInterests(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count shared interests',
      one: '1 shared interest',
    );
    return '$_temp0';
  }

  @override
  String stepOf(int step, int total) {
    return '$step/$total';
  }

  @override
  String get clear => 'Clear';

  @override
  String get previewProfile => 'Preview my profile';

  @override
  String get viewProfile => 'View profile';

  @override
  String get done => 'Done';

  @override
  String get forgotPassword => 'Forgot password?';

  @override
  String get resetTitle => 'Reset your password';

  @override
  String get resetHint => 'We\'ll send a 6-digit code to your email.';

  @override
  String get sendCode => 'Send code';

  @override
  String codeSentTo(String email) {
    return 'We sent a 6-digit code to $email.';
  }

  @override
  String get newPassword => 'New password';

  @override
  String get resetDone => 'Your password has been updated';

  @override
  String get verifyEmailTitle => 'Verify your email';

  @override
  String get code => 'Code';

  @override
  String get verify => 'Verify';

  @override
  String get resendCode => 'Resend code';

  @override
  String resendIn(int seconds) {
    return 'Resend in ${seconds}s';
  }

  @override
  String get codeResent => 'A new code has been sent';

  @override
  String get useAnotherAccount => 'Use another account';

  @override
  String get termsOfService => 'Terms of Service';

  @override
  String get privacyPolicy => 'Privacy Policy';

  @override
  String termsConsent(String terms, String privacy) {
    return 'I\'m 18 or older and I have read and accept the $terms and $privacy.';
  }

  @override
  String get mustAcceptTerms => 'You need to accept the terms to continue.';

  @override
  String get deleteAccount => 'Delete account';

  @override
  String get deleteAccountWarning =>
      'Your account is hidden right away and you are signed out. If you sign in within 30 days it comes back; after that your profile, photos, matches, messages and coin balance are permanently deleted.';

  @override
  String get confirmWithPassword => 'Enter your password to confirm';

  @override
  String get accountDeleted =>
      'Your account is closed for deletion. Sign in within 30 days to restore it.';

  @override
  String get legal => 'Legal';

  @override
  String get verifyProfile => 'Verify your profile';

  @override
  String get verifyProfileHint =>
      'Get the blue check and earn more trust and matches.';

  @override
  String get verifiedLabel => 'Verified profile';

  @override
  String get verificationPendingLabel => 'Verification under review';

  @override
  String get verificationRejectedLabel =>
      'Verification wasn\'t approved, try again';

  @override
  String get verifyTitle => 'Get verified';

  @override
  String get verifyStep =>
      'Take a selfie doing the pose below. Only our verification team sees your selfie; it\'s never shown on your profile.';

  @override
  String get takeSelfie => 'Take a selfie';

  @override
  String get retake => 'Retake';

  @override
  String get verificationSubmitted =>
      'Submitted! It\'s usually reviewed within 24 hours.';

  @override
  String poseLabel(String id) {
    String _temp0 = intl.Intl.selectLogic(id, {
      'peace_sign': '✌️ Make a peace sign',
      'thumbs_up': '👍 Give a thumbs up',
      'hand_on_head': '🙋 Put your hand on your head',
      'point_up': '☝️ Point up',
      'wave': '👋 Wave',
      'other': '$id',
    });
    return '$_temp0';
  }

  @override
  String get errCodeInvalid => 'That code is incorrect.';

  @override
  String get errCodeExpired =>
      'The code expired or had too many attempts. Request a new one.';

  @override
  String get errCodeCooldown =>
      'Please wait a moment before requesting a new code.';

  @override
  String get errRateLimited =>
      'You\'re going too fast. Wait a bit and try again.';

  @override
  String get errBanned =>
      'Your account has been suspended for violating our community rules.';

  @override
  String get errAlreadyVerified => 'Your profile is already verified.';

  @override
  String get errVerificationPending =>
      'Your verification is already under review.';

  @override
  String kmAway(int km) {
    return '$km km away';
  }

  @override
  String get filters => 'Filters';

  @override
  String get ageRange => 'Age range';

  @override
  String get maxDistance => 'Maximum distance';

  @override
  String get anyDistance => 'Any distance';

  @override
  String get apply => 'Apply';

  @override
  String get locationRationale =>
      'We need your location to show people near you. Your exact location is never shared; others only see an approximate distance.';

  @override
  String get enableLocation => 'Enable location';

  @override
  String get superLike => 'Super like';

  @override
  String get superLikeSent => 'Super like sent ⭐';

  @override
  String get superLikedYou => 'Super liked you';

  @override
  String get boost => 'Boost';

  @override
  String get boostTitle => 'Boost your profile';

  @override
  String boostBody(int minutes) {
    return 'Be shown at the top of Discover for $minutes minutes so more people see you.';
  }

  @override
  String boostActive(int minutes) {
    return '$minutes min';
  }

  @override
  String get likesYou => 'Likes you';

  @override
  String likesYouCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count people like you',
      one: '1 person likes you',
      zero: 'No one has liked you yet',
    );
    return '$_temp0';
  }

  @override
  String likesLockedBody(int hours) {
    return 'See who liked you and match instantly when you like them back. Stays open for $hours hours.';
  }

  @override
  String get seeWhoLikes => 'See who';

  @override
  String get noLikesYet =>
      'No likes yet. Complete your profile or try a boost!';

  @override
  String get typing => 'typing...';

  @override
  String get photo => 'Photo';

  @override
  String get viewOncePhoto => 'View-once photo';

  @override
  String get tapToView => 'Tap to view';

  @override
  String get photoOpened => 'Opened';

  @override
  String get photoSent => 'Sent';

  @override
  String get viewOnceHint =>
      'The photo can be opened once, then it\'s deleted.';

  @override
  String get sendPhoto => 'Send photo';

  @override
  String newMessageFrom(String name, String text) {
    return '$name: $text';
  }

  @override
  String newMatchWith(String name) {
    return 'New match: $name 💞';
  }

  @override
  String get newRequestBanner => 'You received a new request';

  @override
  String get view => 'View';

  @override
  String get errAlreadyBoosted => 'Your profile is already boosted.';

  @override
  String get errAlreadyViewed => 'This photo has already been opened.';

  @override
  String get mostPopular => 'Most popular';

  @override
  String firstPurchaseBanner(int pct) {
    return '$pct% bonus coins on your first purchase!';
  }

  @override
  String bonusCoins(int count) {
    return '+$count bonus';
  }

  @override
  String get paymentProcessing => 'Processing your payment...';

  @override
  String purchaseDone(int count) {
    return '$count coins added to your account 🎉';
  }

  @override
  String get txBonus => 'First purchase bonus';

  @override
  String get txClawback => 'Refund (coins reversed)';

  @override
  String get errStoreUnavailable =>
      'The store is unavailable right now. Please try again shortly.';

  @override
  String perMinute(int count) {
    return '$count/min';
  }

  @override
  String startCallTitle(String kind) {
    return 'Start a $kind?';
  }

  @override
  String startCallInfo(int rate) {
    return '$rate coins per minute. The first minute is charged when they answer, and the call ends automatically when your balance runs out.';
  }

  @override
  String get callAction => 'Call';

  @override
  String get calling => 'Calling…';

  @override
  String get isCallingYou => 'is calling you';

  @override
  String earnPerMinute(int rate) {
    return 'You earn $rate coins per minute';
  }

  @override
  String get answer => 'Answer';

  @override
  String get decline => 'Decline';

  @override
  String spentCoins(int count) {
    return 'Spent: $count';
  }

  @override
  String earnedCoins(int count) {
    return 'Earned: $count';
  }

  @override
  String get lowBalanceWarning =>
      'Your balance won\'t cover the next minute; the call will end when this minute is up.';

  @override
  String get videoBlurred => 'For your safety, video starts blurred';

  @override
  String get revealVideo => 'Show video';

  @override
  String get waitingVideo => 'Waiting for video…';

  @override
  String get simulationMode => 'Test mode';

  @override
  String get mute => 'Mute';

  @override
  String get camera => 'Camera';

  @override
  String get flipCamera => 'Flip';

  @override
  String get speaker => 'Speaker';

  @override
  String get gift => 'Gift';

  @override
  String get endCall => 'End';

  @override
  String get sendGiftTitle => 'Send a gift';

  @override
  String get giftInfo => 'All coins go to them.';

  @override
  String giftReceived(String emoji, int count) {
    return 'You got a $emoji gift! +$count coins';
  }

  @override
  String giftSent(String emoji) {
    return '$emoji sent';
  }

  @override
  String get callEnded => 'Call ended';

  @override
  String get callEndedBalance => 'The call ended because the balance ran out.';

  @override
  String get callEndedDisconnect =>
      'The call ended because the connection dropped.';

  @override
  String get callMissed => 'Missed call';

  @override
  String get callNoAnswer => 'No answer';

  @override
  String get callDeclined => 'Call declined';

  @override
  String get callCancelled => 'Call cancelled';

  @override
  String get rateCallTitle => 'How was the call?';

  @override
  String get reportProblem => 'Something wrong? Report it';

  @override
  String get callHistory => 'Calls';

  @override
  String get noCallsYet =>
      'No calls yet. You can start a voice or video call from any profile.';

  @override
  String get callBack => 'Call back';

  @override
  String missedCallFrom(String name) {
    return 'Missed call: $name';
  }

  @override
  String get errBusy => 'They\'re on another call right now, try again soon.';

  @override
  String get errAlreadyInCall => 'You\'re already on a call.';

  @override
  String get errCallGone => 'This call is no longer available.';

  @override
  String get errCallerBalance =>
      'The caller didn\'t have enough balance, so the call didn\'t start.';

  @override
  String get txCall => 'Call';

  @override
  String get txGift => 'Gift';

  @override
  String get cashoutAvailable => 'Available to cash out';

  @override
  String cashoutMinInfo(int coins, String usd) {
    return 'You can cash out once you have at least $coins coins ($usd).';
  }

  @override
  String get cashoutNeedVerify =>
      'To cash out, verify your profile with a blue check. This protects you and your earnings from fake accounts.';

  @override
  String get cashoutAmount => 'Amount';

  @override
  String get cashoutMethod => 'Payout method';

  @override
  String get accountHolder => 'Account holder\'s full name';

  @override
  String get paypalEmail => 'PayPal email';

  @override
  String cashoutSubmit(String usd) {
    return 'Request $usd';
  }

  @override
  String get cashoutProcessingInfo =>
      'Payouts are sent within 3–5 business days. You can cancel while it\'s under review.';

  @override
  String get cashoutRequested => 'Request received 👍';

  @override
  String cashoutNotEnough(int coins) {
    return 'Your cashable balance hasn\'t reached $coins coins yet. Keep earning from calls and accepted requests!';
  }

  @override
  String get payoutStatusPending => 'Under review';

  @override
  String get payoutStatusPaid => 'Paid';

  @override
  String get payoutStatusRejected => 'Declined';

  @override
  String get payoutStatusCancelled => 'Cancelled';

  @override
  String get payoutCancel => 'Cancel request';

  @override
  String get payoutCancelled => 'Request cancelled, coins returned.';

  @override
  String get payoutHistory => 'Requests';

  @override
  String payoutReason(String reason) {
    return 'Reason: $reason';
  }

  @override
  String payoutReference(String ref) {
    return 'Reference: $ref';
  }

  @override
  String get errVerificationRequired =>
      'Verify your profile with a blue check first.';

  @override
  String get errBelowMinimum => 'The amount is below the minimum.';

  @override
  String get errInsufficientCashable =>
      'Your cashable balance isn\'t enough for this amount.';

  @override
  String get errInvalidIban => 'That IBAN looks invalid. Please check it.';

  @override
  String get errAccountNameRequired => 'Enter the account holder\'s name.';

  @override
  String get errPayoutPending => 'You already have a request under review.';

  @override
  String get txCashoutRefund => 'Cash-out returned';

  @override
  String get errInvalidImage =>
      'This photo format isn\'t supported. Choose a JPG, PNG, WEBP or HEIC.';

  @override
  String get errAlreadyRated => 'You\'ve already rated this call.';

  @override
  String get errPayoutProcessed => 'This request has already been processed.';

  @override
  String get errNotFound =>
      'We couldn\'t find that. It may have been removed or is no longer available.';

  @override
  String promoEarnings(int count) {
    return 'Earned from bonus coins: $count';
  }

  @override
  String get promoEarningsInfo =>
      'Comes from payments made with bonus and gift coins. You can spend it in the app, but it can\'t be cashed out.';

  @override
  String get errRequestInProgress =>
      'Your request is still being processed. Try again in a few seconds.';

  @override
  String get errPasswordTooCommon =>
      'This password is too common and easy to guess. Choose a stronger one.';

  @override
  String get errPasswordBreached =>
      'This password appeared in a known data breach. For your safety, choose a different one.';

  @override
  String get errPasswordSame =>
      'Your new password can\'t be the same as your current one.';

  @override
  String get errAccountLocked =>
      'Too many failed attempts. For your security, try again in 15 minutes.';

  @override
  String get errTooManyAccounts =>
      'Too many accounts were created from this device recently.';

  @override
  String get errCaptcha => 'Security check failed. Please try again.';

  @override
  String get devicesTitle => 'My devices';

  @override
  String get devicesSubtitle =>
      'Devices signed in to your account. If you see one you don\'t recognise, sign it out and change your password.';

  @override
  String get thisDevice => 'This device';

  @override
  String lastActive(String time) {
    return 'Last active: $time';
  }

  @override
  String get signOutDevice => 'Sign out';

  @override
  String get signOutOthers => 'Sign out of all other devices';

  @override
  String get signOutOthersConfirm =>
      'All sessions except this device will be signed out.';

  @override
  String get deviceSignedOut => 'Device signed out';

  @override
  String get othersSignedOut => 'Signed out of other devices';

  @override
  String get changePassword => 'Change password';

  @override
  String get currentPassword => 'Current password';

  @override
  String get changePasswordNote =>
      'Changing your password signs you out on every other device.';

  @override
  String get passwordChanged =>
      'Password changed. Other devices were signed out.';

  @override
  String get accountRestored =>
      'Your account has been restored and the deletion request cancelled.';

  @override
  String get privacyAndData => 'Privacy & my data';

  @override
  String get myConsents => 'My consents';

  @override
  String get myData => 'My data';

  @override
  String get legalTexts => 'Documents';

  @override
  String get retentionPolicy => 'Retention and deletion policy';

  @override
  String get readConsentText => 'Read text';

  @override
  String get giveConsent => 'I consent';

  @override
  String get notNow => 'Not now';

  @override
  String get consentSpecialTitle => 'Orientation for matching';

  @override
  String get consentSpecialText =>
      'Who you want to see is used to show you suitable people.';

  @override
  String get consentSpecialAsk =>
      'Who you want to see is special category data; matching needs your explicit consent.';

  @override
  String get consentSpecialOnboarding =>
      'I explicitly consent to the processing of who I want to see (sexual orientation) for matching.';

  @override
  String get consentOverseasTitle => 'Calls and notifications';

  @override
  String get consentOverseasText =>
      'Voice/video calls and push notifications go through servers abroad.';

  @override
  String get consentOverseasAsk =>
      'Calls run through a provider abroad (Agora). To make and receive calls you need to consent to this transfer. Nothing is recorded.';

  @override
  String get consentOverseasRegister =>
      'I consent to my data being transferred abroad for voice/video calls and notifications (optional).';

  @override
  String get consentSelfieTitle => 'Blue check selfie';

  @override
  String get consentSelfieText =>
      'Your verification selfie is reviewed by hand, only by our team.';

  @override
  String get consentSelfieAsk =>
      'You\'ll take a selfie in a specific pose. Only our verification team reviews it, it\'s never shown to anyone and it\'s deleted when you withdraw consent.';

  @override
  String get consentMarketingTitle => 'Offers by email';

  @override
  String get consentMarketingText => 'Discounts and new feature news.';

  @override
  String get consentMarketingRegister =>
      'I\'d like to receive offers and news by email (optional).';

  @override
  String get revokeConsentTitle => 'Withdraw your consent?';

  @override
  String get revokeConsent => 'Withdraw';

  @override
  String get revokeSpecialWarning =>
      'Your profile is removed from discover and you can\'t use discover or likes. Your chats continue.';

  @override
  String get revokeOverseasWarning =>
      'You won\'t be able to make or receive calls or get push notifications.';

  @override
  String get revokeSelfieWarning =>
      'Your stored selfies are deleted and a pending application is cancelled. An existing blue check stays.';

  @override
  String get dataExportTitle => 'Download my data';

  @override
  String get dataExportSubtitle =>
      'A copy of all your data is sent to your email as a link.';

  @override
  String get dataExportAction => 'Request';

  @override
  String get dataExportRequested =>
      'Request received. We\'ll email you a link when it\'s ready.';

  @override
  String get dataExportPreparing =>
      'Preparing… we\'ll email you when it\'s ready.';

  @override
  String dataExportReady(String date) {
    return 'Sent to your email (valid until $date).';
  }

  @override
  String dataExportNextAt(String date) {
    return 'Next request: $date';
  }

  @override
  String get kvkkRequestTitle => 'Data request';

  @override
  String get kvkkRequestSubtitle =>
      'Information, correction, deletion or objection';

  @override
  String get kvkkRequestInfo =>
      'We\'ll answer within 30 days by email and here.';

  @override
  String get kvkkRequestHint => 'Write your request (at least 10 characters)';

  @override
  String get kvkkRequestSent => 'Request received.';

  @override
  String kvkkRequestPending(String date) {
    return 'Under review · due $date';
  }

  @override
  String get kvkkMyRequests => 'My requests';

  @override
  String get kvkkKindInfo => 'Information';

  @override
  String get kvkkKindCorrection => 'Correction';

  @override
  String get kvkkKindDeletion => 'Deletion';

  @override
  String get kvkkKindObjection => 'Objection';

  @override
  String get kvkkKindOther => 'Other';

  @override
  String get reconsentTitle => 'We\'ve updated our terms';

  @override
  String get reconsentBody =>
      'Please read and accept the updated documents to continue. If you don\'t want to, you can download your data or delete your account.';

  @override
  String get reconsentAccept => 'I have read and accept';

  @override
  String get errConsentRequired => 'This feature needs your explicit consent.';

  @override
  String get errPeerCallsDisabled => 'This person has turned off calls.';

  @override
  String get errExportCooldown => 'You can download your data once a month.';
}
