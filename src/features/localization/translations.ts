export type AppLocale = 'en' | 'hi';

export const localeTags: Record<AppLocale, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
};

export const languageNames: Record<AppLocale, string> = {
  en: 'English',
  hi: 'हिन्दी',
};

// English source copy is the key so untranslated additions remain readable.
// The coverage test keeps every visible static phrase represented here.
export const hiTranslations: Readonly<Record<string, string>> = {
  'Choose corrected work date': 'सही कार्य तिथि चुनें',
  'Choose date': 'तिथि चुनें',
  'Choose work date': 'कार्य तिथि चुनें',
  'Clear corrected work date': 'सही कार्य तिथि हटाएँ',
  'Clear date': 'तिथि हटाएँ',
  'Clear work date': 'कार्य तिथि हटाएँ',
  Optional: 'वैकल्पिक',
  Required: 'आवश्यक',
  'Use date': 'तिथि उपयोग करें',
  '% · Basis:': '% · आधार:',
  ', row': ', पंक्ति',
  '. Recording stops at 25 seconds.':
    '. रिकॉर्डिंग 25 सेकंड पर बंद हो जाती है।',
  '. The earlier event remains in history; accepting this proposal would replace it.':
    '. पिछली घटना इतिहास में बनी हुई है; इस प्रस्ताव को स्वीकार करने से यह प्रतिस्थापित हो जाएगा।',
  '1 Report': '1 रिपोर्ट',
  '2 Check': '2 जांचें',
  '3 Send': '3 भेजें',
  'A match score ranks candidates; it is not a probability or proof of completion.':
    'एक मैच स्कोर उम्मीदवारों को रैंक करता है; यह पूर्ण होने की संभावना या प्रमाण नहीं है।',
  'A planner has not activated a schedule for this project.':
    'किसी योजनाकार ने इस परियोजना के लिए कोई शेड्यूल सक्रिय नहीं किया है।',
  'A queryable record of what happened, with supporting evidence.':
    'जो कुछ हुआ, उसका एक पूछताछ योग्य रिकॉर्ड, सहायक साक्ष्य के साथ।',
  'A supervisor check is independent evidence and does not accept the claim.':
    'पर्यवेक्षक की जाँच स्वतंत्र साक्ष्य है और दावे को स्वीकार नहीं करती है।',
  'Accept verified event': 'सत्यापित घटना स्वीकार करें',
  Accepted: 'स्वीकृत',
  'Accepted actuals': 'स्वीकृत वास्तविक',
  'Accepted actuals:': 'स्वीकृत वास्तविक:',
  'Accepted by': 'द्वारा स्वीकार किया गया',
  'Accepted evidence retains its source report and review decision in History. Pending claims do not change accepted schedule counts.':
    'स्वीकृत साक्ष्य इतिहास में अपनी स्रोत रिपोर्ट और समीक्षा निर्णय को बरकरार रखता है। लंबित दावों से स्वीकृत शेड्यूल गणना में परिवर्तन नहीं होता है।',
  'Accepted facts': 'स्वीकृत तथ्य',
  'Accepted field records': 'स्वीकृत फ़ील्ड रिकॉर्ड',
  'Accepted percentage': 'स्वीकृत प्रतिशत',
  'Accepted progress:': 'स्वीकृत प्रगति:',
  Account: 'खाता',
  Activity: 'गतिविधि',
  'Activity ID, source ID, area or wording':
    'गतिविधि आईडी, स्रोत आईडी, क्षेत्र या शब्दांकन',
  'Activity completion by discipline': 'अनुशासन से कार्य पूर्ण करना',
  Actual: 'वास्तविक',
  'Actual finish:': 'वास्तविक समाप्ति:',
  'Actual start:': 'वास्तविक शुरुआत:',
  After: 'के बाद',
  'An active planner or manager membership is required to decide claims.':
    'दावों पर निर्णय लेने के लिए एक सक्रिय योजनाकार या प्रबंधक सदस्यता की आवश्यकता होती है।',
  'An initial schedule has not been activated for this project.':
    'इस परियोजना के लिए प्रारंभिक शेड्यूल सक्रिय नहीं किया गया है।',
  'Ask a project manager to check your membership.':
    'किसी प्रोजेक्ट मैनेजर से अपनी सदस्यता की जाँच करने के लिए कहें।',
  'Ask an administrator to check your project membership.':
    'किसी व्यवस्थापक से अपनी प्रोजेक्ट सदस्यता की जाँच करने के लिए कहें।',
  'Ask reporter': 'रिपोर्टर से पूछो',
  'Ask the reporter one specific question.':
    'रिपोर्टर से एक विशिष्ट प्रश्न पूछें।',
  'Ask your project manager to check your membership, then refresh.':
    'अपने प्रोजेक्ट मैनेजर से अपनी सदस्यता जांचने के लिए कहें, फिर ताज़ा करें।',
  'Asset tag:': 'संपत्ति टैग:',
  'Assigned through': 'के माध्यम से सौंपा गया',
  'Assignment v': 'असाइनमेंट वी',
  'Assignment:': 'असाइनमेंट:',
  Audit: 'लेखापरीक्षा',
  Back: 'वापस',
  'Baseline and accepted field progress, in one read-only view.':
    'बेसलाइन और स्वीकृत फ़ील्ड प्रगति, केवल पढ़ने योग्य दृश्य में।',
  Before: 'पहले',
  'Browser preview: sign-in is cleared when you reload or close this page.':
    'ब्राउज़र पूर्वावलोकन: जब आप इस पृष्ठ को पुनः लोड करते हैं या बंद करते हैं तो साइन-इन साफ़ हो जाता है।',
  Calendar: 'कैलेंडर',
  'Calendar:': 'कैलेंडर:',
  'Can you confirm this exact reported work and date?':
    'क्या आप इस सटीक रिपोर्ट किए गए कार्य और तारीख की पुष्टि कर सकते हैं?',
  Candidate: 'उम्मीदवार',
  'Candidate activities': 'उम्मीदवार गतिविधियाँ',
  'Candidate belongs to the report’s earlier schedule revision.':
    'उम्मीदवार रिपोर्ट के पूर्व शेड्यूल संशोधन से संबंधित है।',
  'Captured evidence': 'दर्ज किया गया साक्ष्य',
  Change: 'परिवर्तन',
  'Change project': 'प्रोजेक्ट बदलें',
  'Check and Send are implemented in later approved slices.':
    'चेक और सेंड को बाद में स्वीकृत स्लाइस में लागू किया गया है।',
  'Check assignment authority and the reported work separately. A check never approves schedule progress.':
    'असाइनमेंट प्राधिकारी और रिपोर्ट किए गए कार्य की अलग-अलग जाँच करें। चेक कभी भी शेड्यूल प्रगति को मंजूरी नहीं देता है।',
  'Check names, dates, quantities and words such as “not.” The edited wording below is what will be submitted.':
    'नाम, दिनांक, मात्रा और "नहीं" जैसे शब्दों की जाँच करें। नीचे संपादित शब्द वही है जो प्रस्तुत किया जाएगा।',
  'Check unavailable': 'जाँच अनुपलब्ध है',
  'Check your report': 'अपनी रिपोर्ट जांचें',
  'Checking production report status…':
    'उत्पादन रिपोर्ट स्थिति की जाँच की जा रही है...',
  'Checking saved session': 'सहेजे गए सत्र की जाँच की जा रही है',
  'Checking your saved session…': 'आपके सहेजे गए सत्र की जाँच की जा रही है…',
  'Checks unavailable': 'चेक अनुपलब्ध हैं',
  'Choose a project': 'एक प्रोजेक्ट चुनें',
  'Choose photo': 'फ़ोटो चुनें',
  'Choose the exact activity': 'सटीक गतिविधि चुनें',
  'Choose your workspace': 'अपना कार्यक्षेत्र चुनें',
  'Clear history filters': 'इतिहास फ़िल्टर साफ़ करें',
  'Completed work': 'काम पूरा हो गया',
  'Completion means an accepted actual finish. Counts do not weight quantities, duration or cost.':
    'समापन का अर्थ है स्वीकृत वास्तविक समापन। गणना में मात्रा, अवधि या लागत का महत्व नहीं होता है।',
  'Confirm each point separately. Assignment authority does not prove completion, and this check does not accept the claim.':
    'प्रत्येक बिंदु की अलग-अलग पुष्टि करें। असाइनमेंट प्राधिकारी पूर्णता साबित नहीं करता है, और यह चेक दावे को स्वीकार नहीं करता है।',
  'Confirmed report wording': 'पुष्टि की गई रिपोर्ट शब्दांकन',
  'Corrected work date': 'सही कार्य तिथि',
  'Correction proposal for accepted event':
    'स्वीकृत घटना के लिए सुधार प्रस्ताव',
  'Corrects event': 'घटना को ठीक करता है',
  'Could not discard': 'त्याग नहीं सका',
  'Could not load authorized activities. Leave activity unselected or reconnect and retry.':
    'अधिकृत गतिविधियों को लोड नहीं किया जा सका. गतिविधि को अचयनित छोड़ दें या पुनः कनेक्ट करें और पुनः प्रयास करें।',
  'Could not load local drafts. Free device storage and retry.':
    'स्थानीय ड्राफ्ट लोड नहीं किया जा सका. नि:शुल्क डिवाइस संग्रहण और पुनः प्रयास करें।',
  'Could not read saved reports from this device.':
    'इस उपकरण से सहेजी गई रिपोर्टें नहीं पढ़ी जा सकीं.',
  'Could not refresh production status. Saved device copies are unchanged.':
    'उत्पादन स्थिति ताज़ा नहीं की जा सकी. सहेजी गई डिवाइस प्रतियां अपरिवर्तित हैं।',
  'Could not refresh. Showing the last loaded review page; claim states may have changed.':
    'ताज़ा नहीं किया जा सका. अंतिम लोड किया गया समीक्षा पृष्ठ दिखा रहा है; दावे की स्थिति बदल गई होगी.',
  'Couldn’t restore your session': 'आपका सत्र पुनर्स्थापित नहीं किया जा सका',
  'Coverage dates:': 'कवरेज तिथियाँ:',
  'Create a field report': 'एक फ़ील्ड रिपोर्ट बनाएं',
  'Current assignments': 'वर्तमान कार्य',
  'Current assignments and the latest report outcomes for your selected project.':
    'आपके चयनित प्रोजेक्ट के लिए वर्तमान असाइनमेंट और नवीनतम रिपोर्ट परिणाम।',
  'Current path': 'वर्तमान पथ',
  'Daily reading:': 'दैनिक पढ़ना:',
  'Date basis:': 'दिनांक आधार:',
  'Date spans are not working durations or productivity. Valid calendars, shifts and a clear quantity basis are required for those comparisons.':
    'दिनांक अवधि कार्य अवधि या उत्पादकता नहीं है. उन तुलनाओं के लिए वैध कैलेंडर, बदलाव और स्पष्ट मात्रा के आधार की आवश्यकता होती है।',
  Decision: 'निर्णय',
  'Decision reason': 'निर्णय का कारण',
  'Decision unavailable': 'निर्णय अनुपलब्ध',
  'Decision:': 'निर्णय:',
  'Describe completed quantities and anything unfinished.':
    'पूर्ण की गई मात्राओं और अपूर्ण किसी भी चीज़ का वर्णन करें।',
  'Direct child branches': 'प्रत्यक्ष बाल शाखाएँ',
  'Discard incomplete save': 'अपूर्ण सहेजें को त्यागें',
  'Discard local report?': 'स्थानीय रिपोर्ट खारिज करें?',
  'Discard this recording?': 'क्या यह रिकॉर्डिंग खारिज करें?',
  'Discard unsaved recording': 'बिना सहेजी गई रिकॉर्डिंग को त्यागें',
  'Discard voice draft?': 'वॉइस ड्राफ्ट त्यागें?',
  Discipline: 'कार्य-क्षेत्र',
  'Drafts stay here after logout and are visible only to this account. Discard removes them permanently. Clearing app data or uninstalling also removes them.':
    'लॉगआउट के बाद ड्राफ्ट यहीं रहते हैं और केवल इस खाते पर दिखाई देते हैं। त्यागें उन्हें स्थायी रूप से हटा देता है। ऐप डेटा साफ़ करने या अनइंस्टॉल करने से भी वे हट जाते हैं।',
  'Earlier assignments are not automatically complete. Actual progress requires an accepted field report.':
    'पहले के कार्य स्वचालित रूप से पूर्ण नहीं होते हैं. वास्तविक प्रगति के लिए एक स्वीकृत फ़ील्ड रिपोर्ट की आवश्यकता होती है।',
  'Earlier check · request version': 'पहले जांचें · अनुरोध संस्करण',
  'Effective accepted events by recorded work date, Monday to Sunday. This is evidence volume, not productivity.':
    'सोमवार से रविवार तक रिकॉर्ड की गई कार्य तिथि के अनुसार प्रभावी रूप से स्वीकृत घटनाएँ। यह साक्ष्य की मात्रा है, उत्पादकता नहीं।',
  Email: 'ईमेल',
  Event: 'घटना',
  'Event date:': 'घटना दिनांक:',
  'Evidence status': 'साक्ष्य की स्थिति',
  'Example: Installed two supports at the north pipe rack; welding remains.':
    'उदाहरण: उत्तरी पाइप रैक पर दो समर्थन स्थापित किए गए; वेल्डिंग बाकी है.',
  'Execution counts': 'निष्पादन मायने रखता है',
  'Execution history': 'निष्पादन इतिहास',
  'Execution history unavailable': 'निष्पादन इतिहास अनुपलब्ध',
  'Execution overview': 'निष्पादन सिंहावलोकन',
  'Explicit items:': 'स्पष्ट आइटम:',
  'Extracted claim': 'निकाला गया दावा',
  'FIELD · ASSIGNED ACTIVITIES': 'फ़ील्ड · सौंपी गई गतिविधियाँ',
  'FIELD · CHECK': 'फ़ील्ड · जांचें',
  'FIELD · CHECK · SEND': 'फ़ील्ड · जांचें · भेजें',
  'FIELD · DELIVERY STATUS': 'फ़ील्ड · डिलिवरी स्थिति',
  'FIELD · INDEPENDENT CHECK': 'फ़ील्ड · स्वतंत्र जाँच',
  'FIELD · INDEPENDENT EVIDENCE': 'क्षेत्र · स्वतंत्र साक्ष्य',
  'FIELD · TEXT AND PHOTO': 'फ़ील्ड · पाठ और फ़ोटो',
  'FIELD · TODAY': 'फ़ील्ड · आज',
  'FIELD · VOICE REPORT': 'फ़ील्ड · आवाज़ रिपोर्ट',
  'FIELD · YOUR REPORT': 'फ़ील्ड · आपकी रिपोर्ट',
  'FR-': 'एफआर-',
  'FROM THE FIELD TO THE PLAN': 'क्षेत्र से योजना तक',
  Field: 'क्षेत्र',
  'Field home': 'मैदानी घर',
  'Field wording is linked to the reviewed activity. It is evidence, not automatically approved vocabulary for future reports.':
    'फ़ील्ड शब्दांकन समीक्षा की गई गतिविधि से जुड़ा हुआ है। यह साक्ष्य है, भविष्य की रिपोर्टों के लिए स्वचालित रूप से स्वीकृत शब्दावली नहीं।',
  'Find accepted work': 'स्वीकृत कार्य खोजें',
  Finish: 'ख़त्म करो',
  'Follow the source schedule branch around this activity.':
    'इस गतिविधि के आसपास स्रोत शेड्यूल शाखा का अनुसरण करें।',
  'Follow-up unavailable': 'अनुवर्ती अनुपलब्ध',
  'Hierarchy unavailable': 'पदानुक्रम अनुपलब्ध',
  'I checked the wording, quantities, work date and unfinished work.':
    'मैंने शब्दों, मात्राओं, कार्य तिथि और अधूरे कार्य की जाँच की।',
  'Include the activity, location, work completed and what remains.':
    'गतिविधि, स्थान, पूरा किया गया कार्य और जो शेष है उसे शामिल करें।',
  'Inspect unresolved field claims, their original report and proposed activity matches.':
    'अनसुलझे फ़ील्ड दावों, उनकी मूल रिपोर्ट और प्रस्तावित गतिविधि मिलान का निरीक्षण करें।',
  'Its text and photos will be permanently removed from this device.':
    'इसका टेक्स्ट और फ़ोटो इस डिवाइस से स्थायी रूप से हटा दिए जाएंगे.',
  KB: 'के.बी',
  'Last checked': 'अंतिम बार जाँच की गई',
  'Loading authorized activities…': 'अधिकृत गतिविधियाँ लोड हो रही हैं...',
  'Loading current evidence…': 'वर्तमान साक्ष्य लोड हो रहा है...',
  'Loading drafts from this device…': 'इस डिवाइस से ड्राफ्ट लोड हो रहा है…',
  'Loading project access…': 'प्रोजेक्ट एक्सेस लोड हो रहा है...',
  'Loading recent reports…': 'हाल की रिपोर्ट लोड हो रही है...',
  'Loading recording…': 'रिकॉर्डिंग लोड हो रही है...',
  'Loading saved reports…': 'सहेजी गई रिपोर्ट लोड हो रही है...',
  'Loading saved report…': 'सहेजी गई रिपोर्ट लोड हो रही है...',
  'Loading your project…': 'आपका प्रोजेक्ट लोड हो रहा है...',
  'Local outbox synchronization is available in the native Nirmaan app.':
    'स्थानीय आउटबॉक्स सिंक्रनाइज़ेशन मूल निर्माण ऐप में उपलब्ध है।',
  'Location:': 'स्थान:',
  'MANAGER · ACCEPTED PLAN': 'प्रबंधक · स्वीकृत योजना',
  'MANAGER · ACCEPTED RECORD': 'प्रबंधक · स्वीकृत रिकार्ड',
  'MANAGER · CONTROLLED CHANGE': 'प्रबंधक · नियंत्रित परिवर्तन',
  'MANAGER · FIELD EVIDENCE': 'प्रबंधक · फ़ील्ड साक्ष्य',
  MOBILE: 'मोबाइल',
  Manager: 'मैनेजर',
  'Manager access required': 'प्रबंधक पहुंच आवश्यक है',
  'Message time:': 'संदेश का समय:',
  'Milestone date:': 'मील का पत्थर तिथि:',
  'Milestone occurrence': 'मील का पत्थर घटना',
  'Milestone occurrence:': 'मील का पत्थर घटना:',
  'My reports': 'मेरी रिपोर्ट',
  'My work': 'मेरा काम',
  'Named in source:': 'स्रोत में नामित:',
  'Needs your attention': 'आपका ध्यान चाहिए',
  Next: 'अगला',
  'Next activities': 'अगली गतिविधियाँ',
  'Next records': 'अगला रिकॉर्ड',
  No: 'नहीं',
  'No accepted events match. Pending reports remain in the review queue.':
    'कोई स्वीकृत ईवेंट मेल नहीं खाता. लंबित रिपोर्टें समीक्षा कतार में रहती हैं।',
  'No active project access': 'कोई सक्रिय प्रोजेक्ट पहुंच नहीं',
  'No active project is selected.': 'कोई सक्रिय प्रोजेक्ट चयनित नहीं है.',
  'No active reporting schedule': 'कोई सक्रिय रिपोर्टिंग शेड्यूल नहीं',
  'No active reporting schedule. Review and accepted evidence remain visible, while activity counts stay at zero.':
    'कोई सक्रिय रिपोर्टिंग शेड्यूल नहीं. समीक्षा और स्वीकृत साक्ष्य दृश्यमान रहते हैं, जबकि गतिविधि संख्या शून्य पर रहती है।',
  'No active schedule': 'कोई सक्रिय शेड्यूल नहीं',
  'No active schedule activities are available by discipline.':
    'अनुशासन द्वारा कोई सक्रिय शेड्यूल गतिविधियाँ उपलब्ध नहीं हैं।',
  'No active schedule for this project.':
    'इस प्रोजेक्ट के लिए कोई सक्रिय शेड्यूल नहीं.',
  'No activities are assigned to you in this project. Ask your supervisor to check your assignments.':
    'इस प्रोजेक्ट में आपको कोई गतिविधियाँ नहीं सौंपी गई हैं। अपने पर्यवेक्षक से अपने असाइनमेंट की जाँच करने के लिए कहें।',
  'No activities match this discipline in the active revision.':
    'सक्रिय पुनरीक्षण में कोई भी गतिविधि इस अनुशासन से मेल नहीं खाती।',
  'No assignment today.': 'आज कोई असाइनमेंट नहीं.',
  'No candidate activity was recorded. This claim needs manual review.':
    'किसी भी उम्मीदवार की गतिविधि दर्ज नहीं की गई. इस दावे की मैन्युअल समीक्षा की आवश्यकता है.',
  'No caption supplied': 'कोई कैप्शन नहीं दिया गया',
  'No child branches in this snapshot.':
    'इस स्नैपशॉट में कोई चाइल्ड ब्रांच नहीं है.',
  'No completed activities match these work filters. Source IDs and field wording can still match accepted records below.':
    'कोई भी पूर्ण गतिविधियाँ इन कार्य फ़िल्टर से मेल नहीं खातीं। स्रोत आईडी और फ़ील्ड शब्दांकन अभी भी नीचे दिए गए स्वीकृत रिकॉर्ड से मेल खा सकते हैं।',
  'No current accepted field records are available yet.':
    'अभी तक कोई वर्तमान स्वीकृत फ़ील्ड रिकॉर्ड उपलब्ध नहीं है।',
  'No field claims currently need a planner decision or follow-up.':
    'वर्तमान में किसी भी फ़ील्ड दावे के लिए योजनाकार निर्णय या अनुवर्ती कार्रवाई की आवश्यकता नहीं है।',
  'No question currently needs your answer. Earlier questions and replies remain in this report.':
    'वर्तमान में किसी भी प्रश्न को आपके उत्तर की आवश्यकता नहीं है। इस रिपोर्ट में पहले के सवाल और जवाब मौजूद हैं.',
  'No reports for this project yet.':
    'इस प्रोजेक्ट के लिए अभी तक कोई रिपोर्ट नहीं है.',
  'No reports saved or submitted yet.':
    'अभी तक कोई रिपोर्ट सहेजी या सबमिट नहीं की गई है.',
  'No supervisor checks are assigned to you in this project.':
    'इस प्रोजेक्ट में आपको कोई पर्यवेक्षक जांच नहीं सौंपी गई है।',
  'No text or photo drafts saved yet.':
    'अभी तक कोई पाठ या फ़ोटो ड्राफ्ट सहेजा नहीं गया है.',
  'No voice drafts saved yet.': 'अभी तक कोई ध्वनि ड्राफ्ट सहेजा नहीं गया.',
  'Not available yet': 'अभी तक उपलब्ध नहीं है',
  'Not recorded': 'रिकार्ड नहीं किया गया',
  'Not selected': 'चयनित नहीं',
  'Not sent for review': 'समीक्षा के लिए नहीं भेजा गया',
  'Not sure': 'निश्चित नहीं',
  'Offline · Connect before loading or answering a planner question.':
    'ऑफ़लाइन · योजनाकार प्रश्न लोड करने या उत्तर देने से पहले कनेक्ट करें।',
  'Offline · Connect before recording a supervisor check.':
    'ऑफ़लाइन · पर्यवेक्षक जांच रिकॉर्ड करने से पहले कनेक्ट करें।',
  'Offline · Connect to load current supervisor checks.':
    'ऑफ़लाइन · वर्तमान पर्यवेक्षक जांच लोड करने के लिए कनेक्ट करें।',
  'Offline · Connect to refresh your session.':
    'ऑफ़लाइन · अपने सत्र को ताज़ा करने के लिए कनेक्ट करें।',
  'Offline · Connect to sign in or refresh your session.':
    'ऑफ़लाइन · साइन इन करने या अपने सत्र को ताज़ा करने के लिए कनेक्ट करें।',
  'Offline · Decisions require a current production connection.':
    'ऑफ़लाइन · निर्णयों के लिए वर्तमान उत्पादन कनेक्शन की आवश्यकता होती है।',
  'Offline · Drafts stay on this device.':
    'ऑफ़लाइन · ड्राफ्ट इस डिवाइस पर रहते हैं।',
  'Offline · Recordings stay on this device.':
    'ऑफ़लाइन · रिकॉर्डिंग इस डिवाइस पर रहती हैं।',
  'Offline · Showing project context already saved on this device. Server data may have changed.':
    'ऑफ़लाइन · इस डिवाइस पर पहले से सहेजा गया प्रोजेक्ट संदर्भ दिखाया जा रहा है। सर्वर डेटा बदल गया होगा.',
  'Offline · Showing saved device reports and the last loaded server status. Sync resumes in the foreground after reconnecting.':
    'ऑफ़लाइन · सहेजी गई डिवाइस रिपोर्ट और अंतिम लोड की गई सर्वर स्थिति दिखा रहा है। पुनः कनेक्ट करने के बाद सिंक अग्रभूमि में फिर से शुरू हो जाता है।',
  'Offline · You can save this confirmation now. Sending resumes after reconnecting.':
    'ऑफ़लाइन · आप इस पुष्टिकरण को अभी सहेज सकते हैं. दोबारा जुड़ने के बाद बायोडाटा भेजा जा रहा है.',
  'Offline · Your last verified project remains selected. Connect before changing projects.':
    'ऑफ़लाइन · आपका अंतिम सत्यापित प्रोजेक्ट चयनित रहेगा। प्रोजेक्ट बदलने से पहले कनेक्ट करें.',
  'One detail to confirm': 'पुष्टि करने के लिए एक विवरण',
  'Only projects with an active membership are available.':
    'केवल सक्रिय सदस्यता वाली परियोजनाएँ ही उपलब्ध हैं।',
  'Open Nirmaan on Android or iOS to save text and photos privately on the device.':
    'डिवाइस पर टेक्स्ट और फ़ोटो को निजी तौर पर सहेजने के लिए एंड्रॉइड या आईओएस पर निर्माण खोलें।',
  'Open decision screen': 'निर्णय स्क्रीन खोलें',
  'Open history': 'इतिहास खोलें',
  'Open report and questions': 'रिपोर्ट और प्रश्न खोलें',
  'Open review queue': 'समीक्षा कतार खोलें',
  'Open supervisor check': 'पर्यवेक्षक जांच खोलें',
  'Open task hierarchy': 'कार्य पदानुक्रम खोलें',
  'Open the workspace for your work on site or in planning.':
    'साइट पर या योजना में अपने काम के लिए कार्यक्षेत्र खोलें।',
  'Optional location or evidence note': 'वैकल्पिक स्थान या साक्ष्य नोट',
  'Original baseline': 'मूल आधार रेखा',
  'Original field report': 'मूल फ़ील्ड रिपोर्ट',
  'Original media evidence': 'मूल मीडिया साक्ष्य',
  'Original report': 'मूल रिपोर्ट',
  'Original transcript:': 'मूल प्रतिलेख:',
  'Original voice transcript': 'मूल आवाज प्रतिलेख',
  'Original work date:': 'मूल कार्य दिनांक:',
  'Overview aggregates are available to active planners and managers.':
    'सक्रिय योजनाकारों और प्रबंधकों के लिए अवलोकन समुच्चय उपलब्ध हैं।',
  'Overview unavailable': 'सिंहावलोकन अनुपलब्ध',
  'PROJECT · READ-ONLY CONTEXT': 'प्रोजेक्ट · केवल पढ़ने योग्य संदर्भ',
  Page: 'पेज',
  Password: 'पासवर्ड',
  'Pending reports do not change this accepted schedule.':
    'लंबित रिपोर्टें इस स्वीकृत शेड्यूल को नहीं बदलतीं।',
  Photo: 'फोटो',
  'Photo caption:': 'फोटो कैप्शन:',
  'Physical quantity and reported percentage are separate from activity completion.':
    'भौतिक मात्रा और रिपोर्ट किया गया प्रतिशत गतिविधि पूर्णता से अलग है।',
  'Plan revision': 'योजना पुनरीक्षण',
  Planned: 'योजना बनाई',
  'Planner matching will use the wording.':
    'योजनाकार मिलान शब्दों का प्रयोग करेगा.',
  Predecessors: 'पूर्ववर्ती',
  'Preview change': 'परिवर्तन का पूर्वावलोकन करें',
  Previous: 'पिछला',
  'Previous activities': 'पिछली गतिविधियां',
  'Previous records': 'पिछला रिकॉर्ड',
  'Progress as of': 'के रूप में प्रगति',
  'Progress as of:': 'इस प्रकार प्रगति:',
  'Progress was reported, but the accepted start date remains unresolved.':
    'प्रगति की सूचना दी गई थी, लेकिन स्वीकृत आरंभ तिथि अभी भी अनसुलझी है।',
  'Project schedule': 'परियोजना अनुसूची',
  'Project unavailable': 'प्रोजेक्ट अनुपलब्ध',
  'Projects unavailable': 'प्रोजेक्ट अनुपलब्ध हैं',
  'Proposed schedule change': 'प्रस्तावित कार्यक्रम परिवर्तन',
  'Quantities, percentage and actual dates are accepted activity facts. Parent nodes do not receive calculated progress here.':
    'मात्राएँ, प्रतिशत और वास्तविक तिथियाँ स्वीकृत गतिविधि तथ्य हैं। मूल नोड्स को यहां परिकलित प्रगति प्राप्त नहीं होती है।',
  'Quantity and progress fields are recorded facts. They do not by themselves mark the activity complete.':
    'मात्रा और प्रगति क्षेत्र दर्ज तथ्य हैं। वे स्वयं गतिविधि को पूर्ण चिह्नित नहीं करते हैं।',
  'Quantity coverage:': 'मात्रा कवरेज:',
  'Queue is clear': 'कतार स्पष्ट है',
  Rank: 'पद',
  'Reason and evidence checked': 'कारण एवं साक्ष्य जांचे गए',
  'Recent accepted records': 'हाल ही में स्वीकृत रिकॉर्ड',
  'Recent report data may be incomplete or stale because refresh failed.':
    'ताज़ा रिपोर्ट विफल होने के कारण हालिया रिपोर्ट डेटा अधूरा या पुराना हो सकता है।',
  'Recent reports': 'हालिया रिपोर्ट',
  'Record supervisor check': 'रिकॉर्ड पर्यवेक्षक की जाँच',
  'Record what you checked and why':
    'रिकॉर्ड करें कि आपने क्या जाँच की और क्यों',
  'Record why this decision is supported by the evidence':
    'रिकॉर्ड करें कि यह निर्णय साक्ष्य द्वारा समर्थित क्यों है',
  Refresh: 'ताज़ा करें',
  'Refresh access': 'पहुंच ताज़ा करें',
  'Refresh drafts': 'ड्राफ्ट ताज़ा करें',
  'Refresh failed · Showing previously loaded history. It may be out of date.':
    'ताज़ा करना विफल · पहले से लोड किया गया इतिहास दिखा रहा है। यह पुराना हो सकता है.',
  'Refresh project': 'प्रोजेक्ट ताज़ा करें',
  'Reject claim': 'दावा अस्वीकार करें',
  'Remove photo': 'फ़ोटो हटाएँ',
  'Report confirmation is available in the native Nirmaan app.':
    'रिपोर्ट की पुष्टि मूल निर्माण ऐप में उपलब्ध है।',
  'Report details': 'रिपोर्ट विवरण',
  'Report follow-up': 'अनुवर्ती रिपोर्ट करें',
  'Report progress': 'प्रगति रिपोर्ट करें',
  'Report your progress': 'अपनी प्रगति रिपोर्ट करें',
  'Reported by': 'द्वारा रिपोर्ट किया गया',
  'Reported percentage:': 'रिपोर्ट किया गया प्रतिशत:',
  'Request supervisor verification': 'पर्यवेक्षक सत्यापन का अनुरोध करें',
  'Resolve uncertainty': 'अनिश्चितता का समाधान करें',
  'Restoring photo…': 'फ़ोटो पुनर्स्थापित किया जा रहा है...',
  'Retry save': 'सहेजने का पुनः प्रयास करें',
  'Return to My reports': 'मेरी रिपोर्ट पर लौटें',
  'Return to My reports and sync until verified media is ready.':
    'मेरी रिपोर्ट्स पर लौटें और सत्यापित मीडिया तैयार होने तक सिंक करें।',
  'Return to last available page': 'अंतिम उपलब्ध पृष्ठ पर लौटें',
  'Return to previous page': 'पिछले पृष्ठ पर लौटें',
  'Review claim': 'दावे की समीक्षा करें',
  'Review decision': 'निर्णय की समीक्षा करें',
  'Review detail': 'समीक्षा विवरण',
  'Review progress': 'प्रगति की समीक्षा करें',
  'Review queue': 'समीक्षा कतार',
  'Review queue unavailable': 'समीक्षा कतार अनुपलब्ध',
  Revision: 'संशोधन',
  'SHA-256': 'SHA-256',
  'SIGNED IN AS': 'के रूप में हस्ताक्षरित',
  'Save on device': 'डिवाइस पर सहेजें',
  'Saved selection. Current activity details are unavailable.':
    'चयन सहेजा गया. वर्तमान गतिविधि विवरण अनुपलब्ध हैं.',
  'Saved, processing, submitted and accepted are separate stages.':
    'सहेजा जाना, संसाधित करना, सबमिट करना और स्वीकृत करना अलग-अलग चरण हैं।',
  'Say the location or line tag, the work completed and what remains.':
    'लोकेशन या लाइन टैग बताएं, काम पूरा हो गया और क्या बाकी है।',
  'Schedule unavailable': 'शेड्यूल अनुपलब्ध',
  'Schedule v': 'अनुसूची वी',
  'Scope:': 'दायरा:',
  'Select an active project or ask a manager to check your membership.':
    'एक सक्रिय प्रोजेक्ट चुनें या किसी प्रबंधक से अपनी सदस्यता की जाँच करने के लिए कहें।',
  'Select an active project or ask an administrator to check your membership.':
    'एक सक्रिय प्रोजेक्ट चुनें या किसी व्यवस्थापक से अपनी सदस्यता की जाँच करने के लिए कहें।',
  'Selected activity': 'चयनित गतिविधि',
  'Selected activity facts': 'चयनित गतिविधि तथ्य',
  'Send answer': 'उत्तर भेजें',
  'Sending an answer does not approve the work. A planner reviews the new proposal separately.':
    'उत्तर भेजने से कार्य स्वीकृत नहीं होता। एक योजनाकार नए प्रस्ताव की अलग से समीक्षा करता है।',
  'Sending creates a report for review. Only an accepted planner decision changes project progress.':
    'भेजने से समीक्षा के लिए एक रिपोर्ट तैयार हो जाती है. केवल एक स्वीकृत योजनाकार निर्णय ही परियोजना की प्रगति को बदलता है।',
  'Show all activities': 'सभी गतिविधियां दिखाएं',
  Showing: 'दिखा रहा हूँ',
  'Showing one selected activity.': 'एक चयनित गतिविधि दिखाई जा रही है.',
  'Showing the hierarchy path stored with this authorized activity. Broader source branches are unavailable in this snapshot.':
    'इस अधिकृत गतिविधि के साथ संग्रहीत पदानुक्रम पथ दिखा रहा है। इस स्नैपशॉट में व्यापक स्रोत शाखाएँ उपलब्ध नहीं हैं।',
  'Sign in to Nirmaan': 'निर्माण में साइन इन करें',
  'Sign-in unavailable': 'साइन-इन अनुपलब्ध',
  'Source WBS / level': 'स्रोत डब्ल्यूबीएस/स्तर',
  'Source hierarchy': 'स्रोत पदानुक्रम',
  'Source parent': 'स्रोत अभिभावक',
  'Speak a short update and save it on this device.':
    'एक संक्षिप्त अपडेट बोलें और इसे इस डिवाइस पर सहेजें।',
  'Stage:': 'स्टेज:',
  Start: 'प्रारंभ करें',
  'Start with decisions waiting for you, then inspect accepted execution.':
    'उन निर्णयों से शुरुआत करें जो आपका इंतजार कर रहे हैं, फिर स्वीकृत निष्पादन का निरीक्षण करें।',
  'State partial or unfinished work explicitly, for example “2 of 8 complete; 6 remain unfinished.”':
    'आंशिक या अधूरा कार्य स्पष्ट रूप से बताएं, उदाहरण के लिए "8 में से 2 पूर्ण; 6 अधूरे हैं।"',
  'Still preparing evidence': 'अभी भी सबूत तैयार कर रहे हैं',
  'Structured observation': 'संरचित अवलोकन',
  'Supervisor check': 'पर्यवेक्षक जाँच',
  'Supervisor check:': 'पर्यवेक्षक जाँच:',
  'Supervisor checks': 'पर्यवेक्षक जाँच करता है',
  'Switch workspace': 'कार्यक्षेत्र बदलें',
  'Tap to': 'पर टैप करें',
  'Task hierarchy': 'कार्य पदानुक्रम',
  'The app’s connection settings are incomplete. Contact your administrator to finish setup.':
    'ऐप की कनेक्शन सेटिंग अधूरी हैं. सेटअप पूरा करने के लिए अपने व्यवस्थापक से संपर्क करें.',
  'The claim, report, policy, assignment, or schedule changed after this check was assigned. It is read-only. Ask the planner for a fresh check against the current evidence.':
    'इस चेक को सौंपे जाने के बाद दावा, रिपोर्ट, नीति, असाइनमेंट या शेड्यूल बदल गया। यह केवल पढ़ने योग्य है. योजनाकार से वर्तमान साक्ष्यों की नये सिरे से जांच के लिए कहें।',
  'The production worker or planner is processing the recorded clarification.':
    'उत्पादन कार्यकर्ता या योजनाकार रिकॉर्ड किए गए स्पष्टीकरण को संसाधित कर रहा है।',
  'The recording will be permanently removed from this device.':
    'इस डिवाइस से रिकॉर्डिंग स्थायी रूप से हटा दी जाएगी.',
  'The review queue changed; this page is now empty.':
    'समीक्षा कतार बदल गई; यह पेज अब खाली है.',
  'This activity is no longer available.': 'यह गतिविधि अब उपलब्ध नहीं है.',
  'This cannot be undone.': 'इसे पूर्ववत नहीं किया जा सकता.',
  'This check is no longer assigned to your account in the selected project.':
    'यह चेक अब चयनित प्रोजेक्ट में आपके खाते को नहीं सौंपा गया है।',
  'This claim is no longer available for review.':
    'यह दावा अब समीक्षा के लिए उपलब्ध नहीं है.',
  'This part of Nirmaan is not ready to use. No project records are shown here yet.':
    'निर्माण का यह भाग उपयोग के लिए तैयार नहीं है। यहां अभी तक कोई प्रोजेक्ट रिकॉर्ड नहीं दिखाया गया है.',
  'This project has no pending, clarification, verification or disputed claims.':
    'इस परियोजना में कोई लंबित, स्पष्टीकरण, सत्यापन या विवादित दावा नहीं है।',
  'This recorded check is retained. The planner makes the schedule decision separately.':
    'यह रिकार्ड किया हुआ चेक सुरक्षित रखा जाता है। योजनाकार शेड्यूल का निर्णय अलग से लेता है।',
  'This report is no longer available.': 'यह रिपोर्ट अब उपलब्ध नहीं है.',
  'This saved report is unavailable for this account.':
    'यह सहेजी गई रिपोर्ट इस खाते के लिए उपलब्ध नहीं है.',
  Timeline: 'समयरेखा',
  'Try again': 'पुनः प्रयास करें',
  'Try again after device storage is available.':
    'डिवाइस स्टोरेज उपलब्ध होने के बाद पुनः प्रयास करें।',
  'Unsent draft (not sent):': 'असंतुलित ड्राफ्ट (नहीं भेजा गया):',
  'Use Sync now to retry this item.':
    'इस आइटम को पुनः प्रयास करने के लिए अभी सिंक का उपयोग करें।',
  'Use the account provided by your project team.':
    'अपनी प्रोजेक्ट टीम द्वारा उपलब्ध कराए गए खाते का उपयोग करें।',
  VOICE: 'वॉइस',
  Version: 'संस्करण',
  'View all': 'सभी देखें',
  'Voice capture requires the Android app':
    'वॉयस कैप्चर के लिए एंड्रॉइड ऐप की आवश्यकता होती है',
  'Voice recording is not available on this platform yet.':
    'इस प्लेटफ़ॉर्म पर अभी तक वॉयस रिकॉर्डिंग उपलब्ध नहीं है।',
  'WELCOME TO NIRMAAN': 'निर्माण में आपका स्वागत है',
  'Was this reporter assigned or authorized to carry out work on this activity?':
    'क्या इस रिपोर्टर को इस गतिविधि पर काम करने के लिए नियुक्त या अधिकृत किया गया था?',
  'Weekly accepted field events': 'साप्ताहिक स्वीकृत फ़ील्ड इवेंट',
  'Welcome back.': 'पुनः स्वागत है.',
  'Where did you work? You may choose more than one.':
    'आपने कहां काम किया? आप एक से अधिक चुन सकते हैं.',
  'Why it needs review': 'इसकी समीक्षा की आवश्यकता क्यों है?',
  'Work date': 'कार्य दिनांक',
  'Work date:': 'कार्य दिनांक:',
  'Work unavailable': 'कार्य अनुपलब्ध',
  'Workspace selection does not change your project access. Project tools are not available yet.':
    'कार्यस्थान चयन आपके प्रोजेक्ट पहुंच को नहीं बदलता है। प्रोजेक्ट उपकरण अभी तक उपलब्ध नहीं हैं.',
  'YYYY-MM-DD': 'YYYY-MM-DD',
  'YYYY-MM-DD (optional)': 'YYYY-MM-DD (वैकल्पिक)',
  Yes: 'हाँ',
  'Your account': 'आपका खाता',
  'Your assigned activities and the work coming next.':
    'आपकी सौंपी गई गतिविधियाँ और आगे आने वाला कार्य।',
  'Your local text and photo drafts': 'आपका स्थानीय पाठ और फ़ोटो ड्राफ्ट',
  'Your local voice drafts': 'आपका स्थानीय वॉयस ड्राफ्ट',
  'Your original report': 'आपकी मूल रिपोर्ट',
  'Your selected project role cannot open the manager schedule.':
    'आपकी चयनित प्रोजेक्ट भूमिका प्रबंधक शेड्यूल नहीं खोल सकती.',
  'Your selected project role cannot read accepted execution history.':
    'आपकी चयनित प्रोजेक्ट भूमिका स्वीकृत निष्पादन इतिहास नहीं पढ़ सकती है।',
  'Your selected project role cannot read candidate matches or review claims.':
    'आपकी चयनित परियोजना भूमिका उम्मीदवार मिलान नहीं पढ़ सकती या दावों की समीक्षा नहीं कर सकती।',
  assigned: 'सौंपा गया',
  by: 'द्वारा',
  bytes: 'बाइट्स',
  'complete ·': 'पूरा · पूरा',
  'current claims. Open the queue for the complete paged list.':
    'वर्तमान दावे. संपूर्ण पृष्ठांकित सूची के लिए कतार खोलें.',
  'in progress': 'प्रगति पर है',
  'is unavailable. Showing the earliest visible branch.':
    'अनुपलब्ध है. सबसे पहले दिखाई देने वाली शाखा दिखा रहा हूँ.',
  'local draft could not be prepared for sync because its saved evidence is incomplete.':
    'स्थानीय ड्राफ्ट सिंक के लिए तैयार नहीं किया जा सका क्योंकि इसके सहेजे गए साक्ष्य अधूरे हैं।',
  of: 'का',
  'of 3 photos · Photos are converted to JPEG and stored privately.':
    '3 फ़ोटो में से · फ़ोटो को JPEG में परिवर्तित किया जाता है और निजी तौर पर संग्रहीत किया जाता है।',
  report: 'रिपोर्ट',
  'reported progress without an accepted start date.':
    'स्वीकृत प्रारंभ तिथि के बिना प्रगति की सूचना दी।',
  'require the mobile app': 'मोबाइल ऐप की आवश्यकता है',
  's / 25s': 'एस / 25 एस',
  'seconds ·': 'सेकंड · सेकंड',
  unresolved: 'अनसुलझा',
  '· Activity-count basis': '· गतिविधि-गणना आधार',
  '· India Standard Time': '· भारत मानक समय',
  '· Match score': '· मैच का स्कोर',
  '· Membership v': '· सदस्यता वी',
  '· Received': '· प्राप्त हुआ',
  '· Selected project': '· चयनित परियोजना',
  '· Source relationships': '· स्रोत संबंध',
  '· State:': '· राज्य:',
  '· Work date:': '· कार्य दिनांक:',
  '· Work:': '· कार्य:',
  '· version': '· संस्करण',
  '— Baseline': '- बेसलाइन',
  '• Missing:': '• गुम:',
  '━ Accepted actual': '━ वास्तविक स्वीकृत',
  '━ Planned': '━ योजनाबद्ध',
  Language: 'भाषा',
  'Choose the language used throughout Nirmaan.':
    'निर्माण में उपयोग की जाने वाली भाषा चुनें।',
  'Language preference could not be saved. Try again.':
    'भाषा की पसंद सहेजी नहीं जा सकी। फिर प्रयास करें।',
  FIELD: 'क्षेत्र',
  MANAGER: 'प्रबंधक',
  Home: 'होम',
  Report: 'रिपोर्ट',
  Overview: 'अवलोकन',
  Review: 'समीक्षा',
  Schedule: 'समय-सारणी',
  History: 'इतिहास',
  '(unit not recorded)': '(इकाई रिकॉर्ड नहीं की गई)',
  'A planner must resolve conflicting report evidence.':
    'एक योजनाकार को परस्पर विरोधी रिपोर्ट साक्ष्यों का समाधान करना होगा।',
  'A reviewer requested clarification from the field.':
    'एक समीक्षक ने क्षेत्र से स्पष्टीकरण का अनुरोध किया।',
  'Accepted finish cannot precede accepted start.':
    'स्वीकृत समाप्ति स्वीकृत प्रारंभ से पहले नहीं हो सकती.',
  'Accepted finish requires an accepted start.':
    'स्वीकृत समाप्ति के लिए स्वीकृत शुरुआत की आवश्यकता होती है।',
  'Accepted progress': 'प्रगति स्वीकार की',
  'Accepted quantity': 'स्वीकृत मात्रा',
  'Accepted record identifiers must be unique.':
    'स्वीकृत रिकॉर्ड पहचानकर्ता अद्वितीय होने चाहिए.',
  'Accepted records must retain server history order.':
    'स्वीकृत रिकॉर्ड को सर्वर इतिहास क्रम बनाए रखना चाहिए।',
  'Accepted start not recorded.': 'स्वीकृत प्रारंभ दर्ज नहीं किया गया.',
  'Active revision': 'सक्रिय पुनरीक्षण',
  'Active schedule': 'सक्रिय कार्यक्रम',
  'Activities must belong to the snapshot project and revision.':
    'गतिविधियाँ स्नैपशॉट प्रोजेक्ट और पुनरीक्षण से संबंधित होनी चाहिए।',
  'Activity record': 'गतिविधि रिकॉर्ड',
  'Activity unavailable in the active schedule':
    'सक्रिय शेड्यूल में गतिविधि अनुपलब्ध है',
  'Actual finish': 'वास्तविक समापन',
  'Actual start': 'वास्तविक शुरुआत',
  'Add report text or a photo before saving.':
    'सहेजने से पहले रिपोर्ट टेक्स्ट या फ़ोटो जोड़ें।',
  All: 'सब',
  'All accepted': 'सभी ने स्वीकार कर लिया',
  'All disciplines': 'सभी अनुशासन',
  'An accepted event cannot correct itself.':
    'एक स्वीकृत घटना स्वयं को सही नहीं कर सकती।',
  'Another work location': 'अन्य कार्य स्थान',
  'Answer needed': 'उत्तर चाहिए',
  'Answer recorded. It is a new proposal for review and does not approve schedule progress.':
    'उत्तर रिकार्ड किया गया। यह समीक्षा के लिए एक नया प्रस्ताव है और शेड्यूल प्रगति को मंजूरी नहीं देता है।',
  'Apply as progress': 'प्रगति के रूप में आवेदन करें',
  'Assignment authority': 'असाइनमेंट प्राधिकारी',
  'Assignment check': 'असाइनमेंट जांच',
  'Attachment count unavailable': 'अनुलग्नक गिनती अनुपलब्ध है',
  'Audit references and accepted facts': 'ऑडिट संदर्भ और स्वीकृत तथ्य',
  'Baseline finish cannot precede baseline start.':
    'बेसलाइन समाप्ति बेसलाइन प्रारंभ से पहले नहीं हो सकती।',
  'Baseline hidden': 'बेसलाइन छिपी हुई',
  'Baseline shown': 'बेसलाइन दिखाई गई',
  'Cannot confirm': 'पुष्टि नहीं कर सकता',
  'Changing…': 'बदल रहा है...',
  'Check and send': 'जांचें और भेजें',
  'Check every proposed field before accepting.':
    'स्वीकार करने से पहले प्रत्येक प्रस्तावित फ़ील्ड की जाँच करें।',
  'Check receipt / retry': 'रसीद जांचें/पुनः प्रयास करें',
  'Check the activity and confirm the corrected report.':
    'गतिविधि की जाँच करें और सही रिपोर्ट की पुष्टि करें।',
  'Checking receipt…': 'रसीद की जाँच की जा रही है...',
  'Choose no more than eight work areas.': 'आठ से अधिक कार्य क्षेत्र न चुनें.',
  'Claims needing action': 'दावों पर कार्रवाई की जरूरत है',
  Complete: 'पूर्ण',
  'Complete or partial scope': 'पूर्ण या आंशिक दायरा',
  'Completed activities': 'पूर्ण गतिविधियाँ',
  Confirm: 'पुष्टि करें',
  'Confirm and send': 'पुष्टि करें और भेजें',
  'Confirmation saved on this device. It will send after reconnecting.':
    'पुष्टिकरण इस डिवाइस पर सहेजा गया. यह पुनः कनेक्ट करने के बाद भेज देगा.',
  'Connect once to load your project. Existing drafts remain available.':
    'अपना प्रोजेक्ट लोड करने के लिए एक बार कनेक्ट करें। मौजूदा ड्राफ्ट उपलब्ध रहेंगे.',
  'Connect once to load your project. Existing drafts stay on this device.':
    'अपना प्रोजेक्ट लोड करने के लिए एक बार कनेक्ट करें। मौजूदा ड्राफ्ट इस डिवाइस पर रहते हैं।',
  'Connect to load assigned checks.':
    'असाइन किए गए चेक लोड करने के लिए कनेक्ट करें.',
  'Connect to load assignments for this project.':
    'इस प्रोजेक्ट के लिए असाइनमेंट लोड करने के लिए कनेक्ट करें।',
  'Connect to load current claim and schedule versions.':
    'वर्तमान दावा और शेड्यूल संस्करण लोड करने के लिए कनेक्ट करें।',
  'Connect to load the current question.':
    'वर्तमान प्रश्न लोड करने के लिए कनेक्ट करें.',
  'Correction status is inconsistent.': 'सुधार की स्थिति असंगत है.',
  'Correction target is not part of the same activity history.':
    'सुधार लक्ष्य समान गतिविधि इतिहास का हिस्सा नहीं है.',
  'Could not confirm receipt. Your entered details remain here; retry to check the same request.':
    'प्राप्ति की पुष्टि नहीं हो सकी. आपके दर्ज किए गए विवरण यहां रहते हैं; उसी अनुरोध की जाँच करने का पुनः प्रयास करें।',
  'Could not discard the incomplete save. Retry.':
    'अपूर्ण सहेजा नहीं जा सका. पुनः प्रयास करें.',
  'Could not finish discarding. Retry the discard action.':
    'त्यागना समाप्त नहीं कर सका. त्यागने की क्रिया पुनः प्रयास करें.',
  'Could not finish saving this draft.':
    'इस ड्राफ्ट को सहेजना पूरा नहीं किया जा सका.',
  'Could not prepare this photo.': 'यह फ़ोटो तैयार नहीं किया जा सका.',
  'Could not restore photo.': 'फ़ोटो पुनर्स्थापित नहीं किया जा सका.',
  'Could not restore your session. Check your connection and try again.':
    'आपका सत्र पुनर्स्थापित नहीं किया जा सका. अपना कनेक्शन जांचें और पुनः प्रयास करें।',
  'Could not save this confirmation.': 'इस पुष्टिकरण को सहेजा नहीं जा सका.',
  'Could not sign in. Check your connection and try again.':
    'साइन इन नहीं किया जा सका। अपना कनेक्शन जांचें और पुनः प्रयास करें।',
  'Could not sign out. Try again.':
    'साइन आउट नहीं किया जा सका. पुनः प्रयास करें।',
  Current: 'वर्तमान',
  'Current contribution': 'वर्तमान योगदान',
  'Date not recorded': 'तारीख दर्ज नहीं की गई',
  Discard: 'त्यागें',
  'Discard draft': 'ड्राफ्ट त्यागें',
  'Discard incomplete': 'अधूरा त्यागें',
  'Discarding…': 'त्याग रहा है...',
  'Draft incomplete or missing': 'ड्राफ्ट अधूरा या गायब',
  'Duplicated accepted evidence fields do not match.':
    'डुप्लिकेट स्वीकृत साक्ष्य फ़ील्ड मेल नहीं खाते।',
  'Email not recorded': 'ईमेल रिकार्ड नहीं किया गया',
  'Enter a valid email address and your password.':
    'एक वैध ईमेल पता और अपना पासवर्ड दर्ज करें।',
  'Equivalent reading already recorded':
    'समतुल्य पाठन पहले ही रिकार्ड किया जा चुका है',
  'Every extracted claim has a final outcome, with different results.':
    'प्रत्येक निकाले गए दावे का अंतिम परिणाम अलग-अलग होता है।',
  'Every extracted claim has been accepted.':
    'निकाले गए प्रत्येक दावे को स्वीकार कर लिया गया है।',
  'Every extracted claim was rejected.':
    'निकाले गए हर दावे को खारिज कर दिया गया।',
  Evidence: 'सबूत',
  'Evidence changed since this check was assigned':
    'यह चेक सौंपे जाने के बाद से साक्ष्य बदल गए',
  'Evidence is still being prepared before confirmation.':
    'पुष्टि से पहले अभी साक्ष्य तैयार किये जा रहे हैं.',
  'Explicit planner mapping': 'स्पष्ट योजनाकार मानचित्रण',
  'Final outcomes recorded': 'अंतिम परिणाम दर्ज किये गये',
  'Full scope reported': 'पूरा दायरा बताया गया',
  Hide: 'छिपाओ',
  'Hide activity record': 'गतिविधि रिकॉर्ड छिपाएँ',
  'Hide audit details': 'ऑडिट विवरण छिपाएँ',
  'Hide report context': 'रिपोर्ट संदर्भ छिपाएँ',
  ITEM_PROGRESS: 'आइटम_प्रगति',
  'If work remains, describe it': 'यदि कार्य शेष रह गया हो तो उसका वर्णन करें',
  'In progress': 'प्रगति पर है',
  'Independent verification is still pending.':
    'स्वतंत्र सत्यापन अभी भी लंबित है.',
  'Is the reported location correct?': 'क्या रिपोर्ट किया गया स्थान सही है?',
  'Keep draft': 'ड्राफ्ट रखें',
  'Keep recording': 'रिकॉर्डिंग करते रहें',
  'Kept as unplanned': 'अनियोजित तरीके से रखा गया',
  Listen: 'सुनो',
  'Load your project to record': 'रिकॉर्ड करने के लिए अपना प्रोजेक्ट लोड करें',
  'Load your project to save a report':
    'रिपोर्ट सहेजने के लिए अपना प्रोजेक्ट लोड करें',
  'Loading accepted records…': 'स्वीकृत रिकॉर्ड लोड हो रहा है...',
  'Loading assigned supervisor checks…':
    'सौंपे गए पर्यवेक्षक चेक लोड हो रहे हैं…',
  'Loading assignments…': 'असाइनमेंट लोड हो रहे हैं…',
  'Loading project…': 'प्रोजेक्ट लोड हो रहा है...',
  'Loading the accepted schedule and review context…':
    'स्वीकृत शेड्यूल और समीक्षा संदर्भ लोड हो रहा है...',
  'Loading the accepted schedule…': 'स्वीकृत शेड्यूल लोड हो रहा है...',
  'Loading the current evidence and schedule versions…':
    'वर्तमान साक्ष्य और शेड्यूल संस्करण लोड हो रहे हैं...',
  'Loading the current task hierarchy…':
    'वर्तमान कार्य पदानुक्रम लोड हो रहा है...',
  'Loading the report and its current questions…':
    'रिपोर्ट और उसके वर्तमान प्रश्न लोड हो रहे हैं...',
  'Loading unresolved claims…': 'अनसुलझे दावे लोड हो रहे हैं...',
  'Loading your assigned work…': 'आपका असाइन किया गया कार्य लोड हो रहा है...',
  'Loading your project access…': 'आपका प्रोजेक्ट एक्सेस लोड हो रहा है...',
  'Local draft incomplete': 'स्थानीय ड्राफ्ट अधूरा',
  'Local report drafts': 'स्थानीय रिपोर्ट ड्राफ्ट',
  'Manual review required': 'मैन्युअल समीक्षा आवश्यक है',
  'Media processing could not be completed.':
    'मीडिया प्रोसेसिंग पूरी नहीं हो सकी.',
  'Media processing needs another attempt.':
    'मीडिया प्रोसेसिंग को एक और प्रयास की आवश्यकता है।',
  'Milestone date': 'मील का पत्थर तिथि',
  'Milestone occurrence must match accepted actual dates.':
    'मील का पत्थर घटना स्वीकृत वास्तविक तिथियों से मेल खाना चाहिए।',
  'Name not recorded': 'नाम दर्ज नहीं है',
  'Need details': 'विवरण चाहिए',
  'Needs planner attention': 'योजनाकार को ध्यान देने की आवश्यकता है',
  'Needs review': 'समीक्षा की जरूरत है',
  'No active revision cannot contain schedule rows.':
    'किसी भी सक्रिय पुनरीक्षण में शेड्यूल पंक्तियाँ नहीं हो सकतीं।',
  'No assignments in this period.': 'इस अवधि में कोई असाइनमेंट नहीं.',
  'No date evidence recorded': 'कोई दिनांक साक्ष्य दर्ज नहीं किया गया',
  'No hierarchy has been loaded for this activity.':
    'इस गतिविधि के लिए कोई पदानुक्रम लोड नहीं किया गया है.',
  'No history has been loaded for this project.':
    'इस प्रोजेक्ट के लिए कोई इतिहास लोड नहीं किया गया है.',
  'No overview has been loaded for this project.':
    'इस प्रोजेक्ट के लिए कोई सिंहावलोकन लोड नहीं किया गया है.',
  'No project selected': 'कोई प्रोजेक्ट चयनित नहीं',
  'No review page has been loaded for this project.':
    'इस प्रोजेक्ट के लिए कोई समीक्षा पृष्ठ लोड नहीं किया गया है.',
  'No schedule has been loaded for this project.':
    'इस प्रोजेक्ट के लिए कोई शेड्यूल लोड नहीं किया गया है.',
  'No work has been loaded for this project.':
    'इस परियोजना के लिए कोई कार्य लोड नहीं किया गया है.',
  'None stated': 'किसी ने नहीं कहा',
  'Not supplied': 'आपूर्ति नहीं की गई',
  'Observed — schedule unchanged': 'अवलोकन किया गया - कार्यक्रम अपरिवर्तित',
  'Offline · Connect to load execution history.':
    'ऑफ़लाइन · निष्पादन इतिहास लोड करने के लिए कनेक्ट करें।',
  'Offline · Connect to load the accepted schedule.':
    'ऑफ़लाइन · स्वीकृत शेड्यूल लोड करने के लिए कनेक्ट करें।',
  'Offline · Connect to load the execution overview.':
    'ऑफ़लाइन · निष्पादन अवलोकन लोड करने के लिए कनेक्ट करें।',
  'Offline · Connect to load the review queue.':
    'ऑफ़लाइन · समीक्षा कतार लोड करने के लिए कनेक्ट करें।',
  'Offline · Connect to load this task hierarchy.':
    'ऑफ़लाइन · इस कार्य पदानुक्रम को लोड करने के लिए कनेक्ट करें।',
  'Offline · Connect to load your assigned work.':
    'ऑफ़लाइन · अपना निर्दिष्ट कार्य लोड करने के लिए कनेक्ट करें।',
  'Offline · Showing previously loaded history. Accepted records may have changed.':
    'ऑफ़लाइन · पहले से लोड किया गया इतिहास दिखा रहा है। स्वीकृत रिकॉर्ड बदल गए होंगे.',
  'Offline · Showing previously loaded work. Assignments may have changed.':
    'ऑफ़लाइन · पहले से लोड किया गया कार्य दिखा रहा है। हो सकता है असाइनमेंट बदल गए हों.',
  'Offline · Showing the last loaded hierarchy. The active revision may have changed.':
    'ऑफ़लाइन · अंतिम लोडेड पदानुक्रम दिखा रहा है। सक्रिय पुनरीक्षण बदल गया होगा.',
  'Offline · Showing the last loaded overview. Counts may have changed.':
    'ऑफ़लाइन · अंतिम लोड किया गया अवलोकन दिखा रहा है। गिनती बदल गई होगी.',
  'Offline · Showing the last loaded schedule. The active revision may have changed.':
    'ऑफ़लाइन · अंतिम लोड किया गया शेड्यूल दिखा रहा है। सक्रिय पुनरीक्षण बदल गया होगा.',
  'Offline · Showing the previously loaded review page. Claim states may have changed.':
    'ऑफ़लाइन · पहले से लोड किया गया समीक्षा पृष्ठ दिखा रहा है। दावा स्थिति बदल गई होगी.',
  'One or more saved photos are missing.':
    'एक या अधिक सहेजी गई फ़ोटो गायब हैं.',
  'Open independent work checks assigned to you in this project.':
    'इस प्रोजेक्ट में आपको सौंपे गए स्वतंत्र कार्य चेक खोलें।',
  'Opening evidence…': 'खुलते सबूत...',
  'Optional corrected date · YYYY-MM-DD': 'वैकल्पिक संशोधित तिथि · YYYY-MM-DD',
  'Or type another location': 'या कोई अन्य स्थान टाइप करें',
  'Other details': 'अन्य विवरण',
  'Other unfinished detail': 'अन्य अधूरा विवरण',
  PERCENT_PROGRESS: 'PERCENT_PROGRESS',
  'PHOTO REPORT': 'फोटो रिपोर्ट',
  'Partial scope reported': 'आंशिक दायरा रिपोर्ट किया गया',
  'Partly accepted': 'आंशिक रूप से स्वीकृत',
  'Photo capture': 'फोटो कैप्चर',
  'Photo ready to save with this draft.':
    'फ़ोटो इस ड्राफ़्ट के साथ सहेजने के लिए तैयार है.',
  'Photo attached. Compression continues in the background.':
    'फ़ोटो जोड़ दी गई है। संपीड़न पृष्ठभूमि में जारी है।',
  'Photo compressed and ready to save.':
    'फ़ोटो संपीड़ित होकर सहेजने के लिए तैयार है।',
  'Photo compression failed.': 'फ़ोटो संपीड़न विफल रहा।',
  'Compressing photo…': 'फ़ोटो संपीड़ित की जा रही है…',
  'Compressing…': 'संपीड़ित किया जा रहा है…',
  'Compression failed': 'संपीड़न विफल रहा',
  'Could not compress photo.': 'फ़ोटो संपीड़ित नहीं की जा सकी।',
  'Planned activities': 'नियोजित गतिविधियाँ',
  'Planned finish cannot precede planned start.':
    'नियोजित समापन नियोजित शुरुआत से पहले नहीं हो सकता।',
  'Preparing photo…': 'फ़ोटो तैयार की जा रही है...',
  'Processing needs attention': 'प्रसंस्करण पर ध्यान देने की जरूरत है',
  'Processing report': 'प्रसंस्करण रिपोर्ट',
  'Production report': 'उत्पादन रिपोर्ट',
  'Progress basis': 'प्रगति का आधार',
  'Project access has not been loaded.':
    'प्रोजेक्ट एक्सेस लोड नहीं किया गया है.',
  'Project not loaded': 'प्रोजेक्ट लोड नहीं हुआ',
  'Project planner': 'परियोजना योजनाकार',
  'Quantity: Not recorded': 'मात्रा: रिकार्ड नहीं किया गया',
  'Ready to record': 'रिकॉर्ड करने के लिए तैयार',
  'Receipt is still pending. Your confirmed wording remains locked.':
    'रसीद अभी भी लंबित है. आपकी पुष्टि की गई शब्दावली लॉक रहती है.',
  'Record the missing detail': 'छूटे हुए विवरण को रिकार्ड करें',
  'Record voice or add text and photos for this project.':
    'इस प्रोजेक्ट के लिए आवाज़ रिकॉर्ड करें या टेक्स्ट और फ़ोटो जोड़ें।',
  'Record voice report': 'ध्वनि रिपोर्ट रिकॉर्ड करें',
  'Recording bytes are missing or incomplete.':
    'रिकॉर्डिंग बाइट्स गुम या अपूर्ण हैं.',
  'Recording incomplete or missing': 'रिकॉर्डिंग अधूरी या गायब',
  'Refreshing…': 'ताज़ा...',
  Rejected: 'अस्वीकृत',
  Replaced: 'बदला गया',
  'Replaced by correction': 'सुधार द्वारा प्रतिस्थापित',
  'Required work date · YYYY-MM-DD': 'आवश्यक कार्य तिथि · YYYY-MM-DD',
  'Retry failed.': 'पुनः प्रयास विफल रहा.',
  'Review report context': 'रिपोर्ट संदर्भ की समीक्षा करें',
  'Saved on device': 'डिवाइस पर सहेजा गया',
  'Saved on device. Not sent for review.':
    'डिवाइस पर सहेजा गया. समीक्षा के लिए नहीं भेजा गया.',
  'Saving confirmation…': 'पुष्टिकरण सहेजा जा रहा है...',
  'Saving to this device…': 'इस डिवाइस में सहेजा जा रहा है...',
  'Saving…': 'सहेजा जा रहा है...',
  'Schedule changed since this check was assigned':
    'यह चेक सौंपे जाने के बाद से शेड्यूल बदल गया',
  'Schedule identifiers must be unique.':
    'शेड्यूल पहचानकर्ता अद्वितीय होने चाहिए.',
  'See decision record': 'निर्णय रिकॉर्ड देखें',
  Select: 'चयन करें',
  Selected: 'चयनित',
  'Sent for review. Planner acceptance is still pending.':
    'समीक्षा हेतु भेजा गया। प्लानर की स्वीकृति अभी भी लंबित है.',
  'Server draft': 'सर्वर ड्राफ्ट',
  'Session refresh is unavailable. Try again when connected.':
    'सत्र ताज़ा उपलब्ध नहीं है. कनेक्ट होने पर पुनः प्रयास करें.',
  Show: 'दिखाओ',
  'Sign in': 'साइन इन करें',
  'Sign out': 'साइन आउट करें',
  'Signed out on this device. Server sign-out could not be confirmed.':
    'इस डिवाइस पर साइन आउट कर दिया गया है. सर्वर साइन-आउट की पुष्टि नहीं की जा सकी.',
  'Signing in…': 'साइन इन किया जा रहा है...',
  'Signing out…': 'साइन आउट हो रहा है...',
  'Some claims are accepted while others still need review.':
    'कुछ दावे स्वीकार कर लिए गए हैं जबकि अन्य की अभी भी समीक्षा की आवश्यकता है।',
  'Some claims were accepted and others reached a different final outcome.':
    'कुछ दावे स्वीकार कर लिए गए और अन्य अलग अंतिम नतीजे पर पहुंचे।',
  'Source hierarchy context': 'स्रोत पदानुक्रम संदर्भ',
  'Stop and save recording': 'रिकॉर्डिंग रोकें और सहेजें',
  'Stop playback': 'प्लेबैक बंद करो',
  'Supervisor check recorded. The planner still makes the schedule decision separately.':
    'पर्यवेक्षक की जाँच रिकार्ड की गई। योजनाकार अभी भी शेड्यूल का निर्णय अलग से लेता है।',
  'Sync could not start. Saved device copies are unchanged.':
    'सिंक प्रारंभ नहीं हो सका. सहेजी गई डिवाइस प्रतियां अपरिवर्तित हैं।',
  'Sync now': 'अभी सिंक करें',
  'Sync pass finished. Delivery status will update while the app remains open.':
    'सिंक पास समाप्त हो गया. ऐप खुला रहने पर डिलीवरी की स्थिति अपडेट हो जाएगी।',
  'Syncing saved reports…': 'सहेजी गई रिपोर्ट समन्वयित हो रही है...',
  'Syncing…': 'सिंक हो रहा है...',
  Uploading: 'अपलोड हो रहा है',
  'Upload status: Uploading': 'अपलोड स्थिति: अपलोड हो रहा है',
  'Saved on device. Upload continues in the background and resumes after reconnecting.':
    'डिवाइस पर सहेजा गया। अपलोड पृष्ठभूमि में जारी रहता है और दोबारा कनेक्ट होने पर फिर शुरू होता है।',
  'TYPE REPORT': 'रिपोर्ट टाइप करें',
  'Take photo': 'फ़ोटो लें',
  Task: 'कार्य',
  'Text report': 'पाठ रिपोर्ट',
  'Text/photo report': 'पाठ/फोटो रिपोर्ट',
  'The current report version could not finish processing.':
    'वर्तमान रिपोर्ट संस्करण प्रसंस्करण समाप्त नहीं कर सका.',
  'The current report version has not produced visible outcomes yet.':
    'वर्तमान रिपोर्ट संस्करण ने अभी तक कोई दृश्यमान परिणाम नहीं दिया है।',
  'The current report version is queued or still processing.':
    'वर्तमान रिपोर्ट संस्करण कतारबद्ध है या अभी भी संसाधित हो रहा है।',
  'The earlier question remains part of the report record.':
    'पिछला प्रश्न रिपोर्ट रिकॉर्ड का हिस्सा बना हुआ है।',
  'The evidence was recorded without changing the schedule.':
    'साक्ष्य को शेड्यूल में बदलाव किए बिना दर्ज किया गया था।',
  'The report is ready for planner review.':
    'रिपोर्ट योजनाकार समीक्षा के लिए तैयार है।',
  'The report reached production and current outcomes are loading.':
    'रिपोर्ट उत्पादन तक पहुंच गई और वर्तमान परिणाम लोड हो रहे हैं।',
  'The server will retry processing the current report version.':
    'सर्वर वर्तमान रिपोर्ट संस्करण को संसाधित करने का पुनः प्रयास करेगा।',
  'The work remains recorded without an accepted plan activity.':
    'कार्य किसी स्वीकृत योजना गतिविधि के बिना रिकॉर्ड किया जाता है।',
  'This question still needs your answer. It will appear after you answer the current question.':
    'इस प्रश्न को अभी भी आपके उत्तर की आवश्यकता है. यह आपके वर्तमान प्रश्न का उत्तर देने के बाद दिखाई देगा.',
  'This recording could not be played. Retry or check device storage.':
    'यह रिकॉर्डिंग नहीं चलाई जा सकी. पुनः प्रयास करें या डिवाइस संग्रहण की जाँच करें।',
  'This recording could not be played. Try listening again.':
    'यह रिकॉर्डिंग नहीं चलाई जा सकी. पुनः सुनने का प्रयास करें.',
  Today: 'आज',
  Type: 'लिखें',
  'Unsaved attempt discarded.': 'सहेजा न गया प्रयास ख़ारिज कर दिया गया.',
  'Verified transcript not available.': 'सत्यापित प्रतिलेख उपलब्ध नहीं है.',
  'View confirmation': 'पुष्टिकरण देखें',
  Voice: 'वॉइस',
  'Voice report': 'आवाज रिपोर्ट',
  'Waiting for the current question': 'वर्तमान प्रश्न की प्रतीक्षा है',
  'Waiting to retry': 'पुनः प्रयास करने की प्रतीक्षा की जा रही है',
  'Waiting to sync.': 'सिंक होने की प्रतीक्षा की जा रही है.',
  'Was the whole activity completed?': 'क्या सारी गतिविधि पूरी हो गई?',
  'Who asked you to work there?': 'तुम्हें वहां काम करने के लिए किसने कहा?',
  'Who assigned the work': 'कार्य किसने सौंपा',
  Withdrawn: 'वापस ले लिया गया',
  'Withdrawn from the production project.': 'उत्पादन परियोजना से हटा लिया गया.',
  'Work check': 'कार्य की जांच',
  'Work date not recorded': 'कार्य दिनांक अंकित नहीं है',
  'Work location': 'कार्य स्थान',
  'Work that remains': 'काम जो बाकी है',
  'Your active project membership is needed for a new report.':
    'नई रिपोर्ट के लिए आपकी सक्रिय परियोजना सदस्यता की आवश्यकता है।',
  'Your confirmed wording is saved and locked until its receipt is verified.':
    'आपकी पुष्टि की गई शब्दावली तब तक सहेजी और लॉक की जाती है जब तक कि उसकी रसीद सत्यापित न हो जाए।',
  'Your session has expired. Sign in again.':
    'आपका सत्र समाप्त हो गया है. पुनः साइन इन करें.',
  'Add a voice note, typed details or photos in any combination.':
    'वॉइस नोट, लिखित विवरण या फ़ोटो किसी भी संयोजन में जोड़ें।',
  'Add typed details (optional)': 'लिखित विवरण जोड़ें (वैकल्पिक)',
  'Optional photo caption': 'वैकल्पिक फ़ोटो विवरण',
  'OPTIONAL SUPPORTING EVIDENCE': 'वैकल्पिक सहायक साक्ष्य',
  'of 3 photos selected': 'में से 3 फ़ोटो चुनी गईं',
  'This recording could not be played. Try again.':
    'यह रिकॉर्डिंग नहीं चलाई जा सकी। फिर से प्रयास करें।',
  'Sending for review…': 'समीक्षा के लिए भेजा जा रहा है…',
  'Send queued. The verified transcript will be attached before submission.':
    'भेजने का अनुरोध कतार में है। जमा करने से पहले सत्यापित प्रतिलेख जोड़ा जाएगा।',
  'Send failed.': 'भेजना विफल रहा।',
  'Cancellation failed.': 'रद्द करना विफल रहा।',
  'Preparing secure upload…': 'सुरक्षित अपलोड तैयार किया जा रहा है…',
  'REVIEW VOICE REPORT': 'वॉइस रिपोर्ट की समीक्षा करें',
  'Recording saved on this device': 'रिकॉर्डिंग इस डिवाइस पर सहेजी गई',
  'Play recording': 'रिकॉर्डिंग चलाएँ',
  Transcript: 'प्रतिलेख',
  'Voice transcript': 'वॉइस प्रतिलेख',
  'Transcribing…': 'प्रतिलेखन हो रहा है…',
  'Offline · Upload resumes after reconnecting.':
    'ऑफ़लाइन · दोबारा कनेक्ट होने पर अपलोड जारी रहेगा।',
  'Send requested · Waiting for verified media.':
    'भेजने का अनुरोध किया गया · सत्यापित मीडिया की प्रतीक्षा है।',
  'Sent for review.': 'समीक्षा के लिए भेजा गया।',
  'Canceling…': 'रद्द किया जा रहा है…',
  Cancel: 'रद्द करें',
  'Queuing…': 'कतार में जोड़ा जा रहा है…',
  Send: 'भेजें',
  'Cancellation queued. Server cleanup will retry after reconnecting.':
    'रद्द करने का अनुरोध कतार में है। दोबारा कनेक्ट होने पर सर्वर की सफ़ाई फिर होगी।',
  'Voice report canceled.': 'वॉइस रिपोर्ट रद्द कर दी गई।',
  'Cancellation is queued. Local evidence stays private until server cleanup succeeds.':
    'रद्द करने का अनुरोध कतार में है। सर्वर की सफ़ाई पूरी होने तक स्थानीय साक्ष्य निजी रहेगा।',
  'This report is already being canceled.':
    'यह रिपोर्ट पहले से रद्द की जा रही है।',
  'A submitted report cannot be canceled from this review.':
    'जमा की गई रिपोर्ट को इस समीक्षा से रद्द नहीं किया जा सकता।',
  'Immediate Send is available for voice reports.':
    'तुरंत भेजने की सुविधा वॉइस रिपोर्ट के लिए उपलब्ध है।',
  'The saved recording could not enter the outbox.':
    'सहेजी गई रिकॉर्डिंग भेजने की कतार में नहीं जा सकी।',
  'Canceling report': 'रिपोर्ट रद्द की जा रही है',
  'Server cleanup will retry before local evidence is removed.':
    'स्थानीय साक्ष्य हटाने से पहले सर्वर की सफ़ाई का पुनः प्रयास होगा।',
  'The report will submit after its verified transcript is ready.':
    'सत्यापित प्रतिलेख तैयार होने के बाद रिपोर्ट जमा होगी।',
  'activities have': 'गतिविधियाँ हैं',
  'activity has': 'गतिविधि है',
  'basis not recorded': 'आधार दर्ज नहीं किया गया',
  signedIn: 'साइन इन करें',
  signedOut: 'हस्ताक्षरित',
  'stop and save': 'रुकें और बचाएं',
  '· Automatic checks active': '· स्वचालित जाँच सक्रिय',
};
