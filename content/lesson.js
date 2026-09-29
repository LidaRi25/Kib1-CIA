/*
 * KIB1 — CIA Incidentu laboratorija
 * Viss mācību saturs un vērtēšanas atslēgas.
 *
 * Svarīgi pedagogam:
 *  - Fakti par reālajiem incidentiem apkopoti 2026. gada septembrī no publiskiem avotiem
 *    (CERT.LV, uzņēmumu paziņojumi, LSM, TVNET, Apollo, Diena, Jauns.lv, LVRTC u.c.).
 *    Pie katra avota ir saite — pirms stundas ieteicams tās atvērt un pārliecināties.
 *  - Ieraksti ar atzīmi "illustrative: true" (X, Threads, anonīmi komentāri) NAV citāti no
 *    konkrētiem kontiem. Tie ir mācību nolūkam veidoti tipiski apgalvojumi, kas atspoguļo
 *    publiskajā telpā izplatītus vēstījumus (piem., TVNET "Faktomāts" par LVM un vēlēšanām).
 *  - Ekspertu teiktais sniegts kā parafrāze ar atsauci uz publikāciju.
 *
 * Atslēgu formāts:
 *  single/multi:   key: ['C'] vai ['C','A']
 *  status:         key: { C: { ok: ['P'], half: ['I'] }, ... }   P=Pierādīts, I=Iespējams, N=Nav pierādījumu
 *  classify:       key: { kind: { ok: [...], half: [...] }, cia: [...], ciaOpt: [...] }
 *  assessment:     key: { ratings: { C: { ok: [..], half: [..] } }, facts: { C: [...] }, bad: [...] }
 */

const EL = ['C', 'I', 'A'];

const EL_INFO = {
  C: { code: 'C', en: 'Confidentiality', lv: 'Konfidencialitāte' },
  I: { code: 'I', en: 'Integrity', lv: 'Integritāte' },
  A: { code: 'A', en: 'Availability', lv: 'Pieejamība' }
};

const STATUS = {
  P: 'Pierādīts',
  I: 'Iespējams',
  N: 'Nav pierādījumu'
};

const KINDS = {
  FAKTS: 'FAKTS',
  EKSP: 'EKSPERTA INTERPRETĀCIJA',
  PIEN: 'PIEŅĒMUMS',
  NAVP: 'NAV PIETIEKAMI PIERĀDĪJUMU'
};

const KIND_HELP = {
  FAKTS: 'Apstiprināts oficiālā vai kompetentā avotā (uzņēmums, CERT.LV, policija), pārbaudāms.',
  EKSP: 'Speciālista skaidrojums vai vērtējums. Balstīts zināšanās, bet nav oficiāli apstiprināts fakts.',
  PIEN: 'Kāda minējums, emocijas vai secinājums bez pamatojuma.',
  NAVP: 'Konkrēts apgalvojums, kas varētu būt patiess, bet šobrīd nav apstiprināts (piem., uzbrucēja paziņojums, viena cilvēka pieredze).'
};

const RATING_LABELS = ['0 — nav pierādījumu', '1 — zema', '2 — vidēja', '3 — augsta', '4 — kritiska'];

const SOURCE_TYPES = {
  company: 'UZŅĒMUMA PAZIŅOJUMS',
  cert: 'CERT.LV',
  media: 'MEDIJS',
  expert: 'EKSPERTS',
  strazdins: 'ELVISS STRAZDIŅŠ',
  x: 'X',
  threads: 'THREADS',
  anon: 'ANONĪMS KOMENTĒTĀJS',
  telegram: 'TELEGRAM',
  official: 'VALSTS INSTITŪCIJA'
};

const CATEGORIES = {
  fund: { title: 'CIA pamatu izpratne', weight: 15 },
  warm: { title: 'Vienkāršo situāciju klasifikācija', weight: 15 },
  cases: { title: 'Reālo incidentu CIA analīze', weight: 30 },
  sources: { title: 'Avotu izmantošana CIA pamatojumam', weight: 15 },
  detective: { title: 'CIA detektīvs', weight: 10 },
  final: { title: 'Noslēguma incidenta analīze', weight: 15 }
};

// Latvijas 10 ballu skala (procenti -> atzīme)
const GRADE_SCALE = [
  { min: 95, grade: 10 },
  { min: 87, grade: 9 },
  { min: 79, grade: 8 },
  { min: 69, grade: 7 },
  { min: 59, grade: 6 },
  { min: 47, grade: 5 },
  { min: 34, grade: 4 },
  { min: 21, grade: 3 },
  { min: 11, grade: 2 },
  { min: 0, grade: 1 }
];

/* ------------------------------------------------------------------ */
/* 1. IEMĀCIES CIA                                                     */
/* ------------------------------------------------------------------ */

const CARDS = [
  {
    el: 'C',
    title: 'CONFIDENTIALITY',
    lv: 'Konfidencialitāte',
    def: 'Informācijai piekļūst tikai tie, kam tai ir tiesības piekļūt.',
    question: 'Vai kāds, kam nav tiesību, ieguva vai redzēja informāciju?',
    examples: [
      'nozagta klientu datubāze',
      'nopludinātas paroles',
      'publiskoti darbinieku personas dati',
      'nepiederoša persona piekļūst medicīniskai informācijai'
    ]
  },
  {
    el: 'I',
    title: 'INTEGRITY',
    lv: 'Integritāte',
    def: 'Informācija un sistēmas netiek neatļauti izmainītas.',
    question: 'Vai dati vai sistēma tika neatļauti mainīti? Vai varam uzticēties datu pareizībai?',
    examples: [
      'izmainīts maksājuma saņēmēja konts',
      'izmainīti vērtējumi datubāzē',
      'uzlauztā mājaslapā nomainīts saturs',
      'modificēti finanšu ieraksti'
    ]
  },
  {
    el: 'A',
    title: 'AVAILABILITY',
    lv: 'Pieejamība',
    def: 'Sistēma un informācija nepieciešamajā brīdī ir pieejama.',
    question: 'Vai lietotāji varēja izmantot sistēmu un piekļūt datiem, kad tas bija vajadzīgs?',
    examples: [
      'DDoS rezultātā nestrādā mājaslapa',
      'ransomware bloķē sistēmas',
      'klienti nevar izmantot e-pakalpojumu',
      'servera darbība ir pārtraukta'
    ]
  }
];

const RULES = [
  'Viens incidents var skart vienu, divus vai visus trīs CIA elementus.',
  'Nopietns incidents NEnozīmē, ka skarti visi trīs elementi.',
  'Ja avotos nav pierādījumu — pareizā atbilde ir “Nav pietiekamu datu”, nevis minējums.',
  'Vērtējums mainās, kad parādās jauni pierādījumi.'
];

const FUND_ITEMS = [
  {
    id: 'f1', type: 'single', cat: 'fund', options: 'CIA',
    prompt: '“Informācijai piekļūst tikai tie, kam ir tiesības tai piekļūt.” Kuru CIA principu apraksta šis teikums?',
    key: ['C'],
    explain: 'Tā ir Confidentiality (konfidencialitāte) — jautājums ir par to, KURŠ var redzēt vai iegūt informāciju.'
  },
  {
    id: 'f2', type: 'single', cat: 'fund', options: 'CIA',
    prompt: '“Informācija un sistēmas netiek neatļauti izmainītas — datiem var uzticēties.” Kuru CIA principu apraksta šis teikums?',
    key: ['I'],
    explain: 'Tā ir Integrity (integritāte) — jautājums ir par to, vai dati ir PAREIZI un NEIZMAINĪTI.'
  },
  {
    id: 'f3', type: 'single', cat: 'fund', options: 'CIA',
    prompt: '“Sistēma un informācija ir lietojama tad, kad tā ir vajadzīga.” Kuru CIA principu apraksta šis teikums?',
    key: ['A'],
    explain: 'Tā ir Availability (pieejamība) — jautājums ir par to, vai sistēmu var IZMANTOT vajadzīgajā brīdī.'
  },
  {
    id: 'f4', type: 'multi', cat: 'fund', tags: ['overlap'],
    prompt: 'Uzbrucējs: 1) iegūst klientu datubāzi; 2) izmaina tajā informāciju; 3) pēc tam nošifrē serveri. Kurus CIA elementus viņš skāra? (atzīmē visus, kas attiecas)',
    key: ['C', 'I', 'A'],
    explain: '1) Datubāzes iegūšana → C. 2) Informācijas izmainīšana → I. 3) Servera nošifrēšana → A (dati nav lietojami). Šeit skarti VISI trīs — bet tikai tāpēc, ka par katru ir konkrēts fakts.'
  },
  {
    id: 'f5', type: 'multi', cat: 'fund', tags: ['ransomware'],
    prompt: 'Uzbrucējs vispirms nokopē uzņēmuma failus uz savu serveri, pēc tam palaiž ransomware, kas nošifrē uzņēmuma serverus. Par datu satura izmainīšanu nekas nav zināms. Kurus CIA elementus skāra? (atzīmē visus, kas attiecas)',
    key: ['C', 'A'],
    explain: 'Failu nokopēšana → C. Nošifrēti serveri (nevar strādāt) → A. Par datu satura izmainīšanu fakti nav — tāpēc I šeit neatzīmējam. Mūsdienu ransomware bieži ir “dubultā izspiešana”: gan zādzība (C), gan bloķēšana (A).'
  },
  {
    id: 'f6', type: 'single', cat: 'fund', options: 'TF', tags: ['allcia'],
    prompt: 'Apgalvojums: “Ja organizācijā noticis kiberuzbrukums, tas vienmēr nozīmē, ka skarti visi trīs — C, I un A.”',
    key: ['F'],
    explain: 'Nepatiess. Piemēram, DDoS parasti skar tikai A, bet datu noplūde, kurā sistēmas turpina strādāt, — tikai C. Katrs CIA elements jāpamato ar faktiem atsevišķi.'
  }
];

/* ------------------------------------------------------------------ */
/* 2. IESILDĪŠANĀS                                                     */
/* ------------------------------------------------------------------ */

const WARM_ITEMS = [
  { id: 'w1', prompt: 'Nozagta klientu datubāze.', key: ['C'], tags: ['leak'],
    explain: 'C — datus ieguva kāds, kam nav tiesību. Datubāze turpina strādāt, tāpēc tā nav A problēma.' },
  { id: 'w2', prompt: 'Uzbrucējs maina bankas konta numuru rēķinā.', key: ['I'],
    explain: 'I — informācija (rēķins) neatļauti izmainīta. Rēķins joprojām ir pieejams, bet tam vairs nevar uzticēties.' },
  { id: 'w3', prompt: 'DDoS uzbrukuma dēļ vietne nav pieejama.', key: ['A'], tags: ['ddos'],
    explain: 'A — lietotāji nevar izmantot vietni. DDoS nozīmē pārslodzi, nevis datu zādzību.' },
  { id: 'w4', prompt: 'Ransomware nošifrē datus, un organizācija tiem vairs nevar piekļūt.', key: ['A'], tags: ['ransomware'],
    explain: 'A — dati joprojām “ir”, bet tos nevar izmantot. Ja būtu zināms, ka dati arī nokopēti, klāt nāktu C.' },
  { id: 'w5', prompt: 'Darbinieks pa kļūdu nosūta visu darbinieku algu sarakstu nepareizam adresātam.', key: ['C'], tags: ['leak'],
    explain: 'C — informāciju saņēma persona bez tiesībām. Arī nejauša kļūda var būt konfidencialitātes incidents.' },
  { id: 'w6', prompt: 'Audzēknis uzlauž e-žurnālu un izmaina savas atzīmes.', key: ['I'],
    explain: 'I — dati neatļauti izmainīti. E-žurnāls strādā (A nav skarts), bet atzīmēm vairs nevar uzticēties.' },
  { id: 'w7', prompt: 'Serveru telpā ugunsgrēks — e-pakalpojums nestrādā 2 dienas.', key: ['A'],
    explain: 'A — pakalpojums nav pieejams. Pieejamību var apdraudēt ne tikai hakeri, bet arī ugunsgrēks, elektrības zudums, plūdi.' },
  { id: 'w8', prompt: 'Darbinieku paroles nopludinātas publiskā forumā.', key: ['C'], tags: ['leak'],
    explain: 'C — slepena informācija (paroles) nonāca pie nepiederošiem. Paroļu noplūde vēlāk var novest arī pie I vai A incidentiem.' },
  { id: 'w9', prompt: 'Uzlauztā mājaslapā uzbrucējs nomaina saturu uz saviem saukļiem (defacement).', key: ['I'],
    explain: 'I — mājaslapas saturs neatļauti izmainīts. Lapa ir atvērta (pieejama), bet tās saturam nevar uzticēties.' },
  { id: 'w10', prompt: 'Mākoņpakalpojuma kļūmes dēļ klienti 5 stundas nevar pieslēgties internetbankai. Dati nav bojāti.', key: ['A'],
    explain: 'A — klienti nevar izmantot pakalpojumu. Dati nav bojāti un nav nopludināti — tāpēc tikai A.' }
].map((q) => ({ ...q, type: 'single', cat: 'warm', options: 'CIA', prompt: q.prompt }));

/* ------------------------------------------------------------------ */
/* 3. CASE 01 — LATVIJAS VALSTS MEŽI                                    */
/* ------------------------------------------------------------------ */

const LVM = {
  id: 'lvm',
  code: 'CASE 01',
  title: 'LATVIJAS VALSTS MEŽI',
  org: 'AS “Latvijas valsts meži” (LVM)',
  period: '2026. gada jūnijs – augusts',
  tags: ['ransomware'],
  briefing: {
    title: 'Ziņu apskats: kiberuzbrukums LVM',
    slides: [
      { t: '22. jūnijs, 2026', text: 'Jāņu brīvdienu priekšvakarā AS “Latvijas valsts meži” (LVM) konstatē apjomīgu kiberuzbrukumu savai IT infrastruktūrai.' },
      { t: 'Sistēmas atslēgtas', text: 'Drošības nolūkos atslēgtas vairākas ārējās sistēmas: karšu pakalpojums “LVM GEO” un medību lietotne “Mednis”, kā arī iekšējās sistēmas informācijas apmaiņai ar klientiem un pakalpojumu sniedzējiem.' },
      { t: 'Vēlēšanu sistēma', text: 'LVM ir viens no uzņēmumiem, kas izstrādā Saeimas vēlēšanu sistēmu. Uzņēmums norāda: vēlēšanu sistēmas izstrāde bija nodalīta un nav skarta, bet drošības nolūkos tiks pārbaudīta.' },
      { t: 'Kas iesaistīts', text: 'Incidenta apstākļu noskaidrošanā iesaistīts CERT.LV, Valsts policija sākusi kriminālprocesu.' },
      { t: 'Tavs uzdevums', text: 'Tu esi Junior Cyber Incident Analyst. Nesteidzies ar secinājumiem — vērtē tikai to, ko šobrīd apliecina fakti.' }
    ],
    links: [
      { label: 'LSM: “LVM piedzīvojuši kiberuzbrukumu; vēlēšanu sistēma nav cietusi” (25.06.2026)', url: 'https://www.lsm.lv/raksts/zinas/latvija/25.06.2026-latvijas-valsts-mezi-piedzivojusi-kiberuzbrukumu-velesanu-sistema-nav-cietusi.a652634/' },
      { label: 'TVNET video: “Uzbrukums LVM, iespējams, bijis komerciāli motivēts”', url: 'https://www.tvnet.lv/8497508/video-uzbrukums-latvijas-valsts-meziem-iespejams-bijis-komerciali-motivets' },
      { label: 'Apollo video: “Eksperts atklāj, kāpēc hakerim izdevās sekmīgs kiberuzbrukums LVM”', url: 'https://www.apollo.lv/8498222/video-eksperts-atklaj-kapec-hakerim-izdevas-sekmigs-kiberuzbrukums-latvijas-valsts-meziem' }
    ]
  },
  stages: [
    {
      id: 'lvm-s0', time: '25.06. · Sākotnējā ziņa',
      blocks: [
        { src: 'company', outlet: 'LVM paziņojums', date: '2026. g. jūnijs', url: 'https://www.lvm.lv/jaunumi/8018-lvm-saskaries-ar-kiberdrosibas-incidentu',
          text: 'LVM saskāries ar kiberdrošības incidentu. Drošības nolūkos atslēgtas vairākas ārējās IT sistēmas — “LVM GEO”, karšu pakalpojumu sistēma un medību lietotne “Mednis”, kā arī vairākas iekšējās sistēmas. Vēlēšanu sistēmas izstrāde bija nodalīta un nav skarta.' }
      ],
      key: { C: { ok: ['I'], half: ['N'] }, I: { ok: ['N', 'I'] }, A: { ok: ['P'], half: ['I'] } },
      explain: {
        C: 'Iespējams. Ir ielaušanās, bet vēl nav neviena fakta par to, vai dati nokopēti. Tāpēc “Pierādīts” būtu pārsteidzīgi.',
        I: 'Nav pierādījumu / iespējams. Nav informācijas par datu izmaiņām. Abas atbildes ir pieņemamas, bet “Pierādīts” — nē.',
        A: 'Pierādīts. Sistēmas ir atslēgtas un lietotāji tās nevar izmantot. Arī tad, ja sistēmu izslēdz pats uzņēmums aizsardzības nolūkā, pieejamība ir ietekmēta.'
      }
    },
    {
      id: 'lvm-s1', time: '26.06. · CERT.LV un sociālie tīkli',
      blocks: [
        { src: 'cert', outlet: 'CERT.LV (pēc LSM)', date: '26.06.2026', url: 'https://www.lsm.lv/raksts/zinas/latvija/26.06.2026-certlv-atbildibu-par-kiberuzbrukumu-latvijas-valsts-meziem-uznemies-arvalstu-izspiedejvirusu-grupejums.a652861/',
          text: 'Atbildību par uzbrukumu uzņēmies ārvalstu, finansiāli motivēts izspiedējvīrusu (ransomware) grupējums. Nav pamata uzskatīt, ka uzbrukums bija mērķēts tieši pret Latviju.' },
        { src: 'x', outlet: 'X', date: '26.06.2026', illustrative: true,
          text: '🚨 LVM uzlauza, lai sagrozītu Saeimas vēlēšanas! Vēlēšanu rezultāti jau ir iepriekš izmainīti!!! Dalies, kamēr nav nodzēsts!' }
      ],
      key: { C: { ok: ['I'], half: ['N'] }, I: { ok: ['N', 'I'] }, A: { ok: ['P'] } },
      explain: {
        C: 'Iespējams. Ransomware grupējumi mēdz datus arī nozagt (dubultā izspiešana), taču konkrēta fakta par noplūdi šajā brīdī vēl nav.',
        I: 'Nav pierādījumu. X ieraksts par “izmainītiem vēlēšanu rezultātiem” nav pierādījums — LVM norāda, ka vēlēšanu sistēma nav skarta. Vēlāk TVNET Faktomāts šos apgalvojumus atspēkoja.',
        A: 'Pierādīts. Ransomware uzbrukums un atslēgtās sistēmas nozīmē pieejamības ietekmi.'
      }
    },
    {
      id: 'lvm-s2', time: '28.06. · Eksperts',
      blocks: [
        { src: 'strazdins', outlet: 'Elviss Strazdiņš, kiberdrošības eksperts (pēc LSM)', date: '28.06.2026', url: 'https://www.lsm.lv/raksts/zinas/latvija/28.06.2026-eksperts-hakeris-par-latvijas-valsts-mezu-datu-atsifresanu-sagaida-vairak-neka-600-000-eiro.a652989/',
          text: 'Parafrāze: sazinoties ar uzbrucēju, eksperts noskaidrojis, ka par LVM datu atšifrēšanu tiek prasīti 0,1% no uzņēmuma ieņēmumiem — vairāk nekā 600 000 eiro. Ielaušanās notikusi caur novecojušu “GeoServer” programmatūru ar sen zināmu ievainojamību.' },
        { src: 'company', outlet: 'LVM (pēc TVNET)', date: '2026. g. jūnija beigas', url: 'https://www.tvnet.lv/8500753/lvm-atklaj-jaunas-detalas-par-kiberuzbrukumu-un-iespejamo-datu-nopludi',
          text: 'LVM: jebkāda iespējamā datu noplūde tika apturēta 22. jūnijā, kad uzņēmums atslēdza IT infrastruktūru.' }
      ],
      key: { C: { ok: ['I'], half: ['P', 'N'] }, I: { ok: ['N', 'I'] }, A: { ok: ['P'] } },
      explain: {
        C: 'Iespējams (joprojām). LVM runā par “iespējamo” noplūdi — tas nozīmē, ka tā nav izslēgta, bet vēl nav apstiprināta. “Pierādīts” šeit ir pāragri.',
        I: 'Nav pierādījumu / iespējams. Uzbrucējam bija piekļuve sistēmām, bet par datu satura mainīšanu faktu nav.',
        A: 'Pierādīts. Prasība maksāt par “atšifrēšanu” nozīmē, ka dati ir nošifrēti — tas ir tipisks pieejamības trieciens.'
      }
    },
    {
      id: 'lvm-s3', time: 'Jūlija sākums · CERT.LV par noplūdi',
      blocks: [
        { src: 'cert', outlet: 'CERT.LV (pēc Diena/LETA)', date: '2026. g. jūlija sākums', url: 'https://diena.lv/raksts/latvija/zinas-71/certlv-uzbrucejs-nopludinajis-44-gigabaitus-no-lvm-kiberuzbrukuma-iegutajiem-datiem',
          text: 'Uzbrucējs nopludinājis 44 GB no uzbrukumā iegūtajiem datiem; iegūtais apjoms, visticamāk, ir lielāks. Tajos ir iekšējie dokumenti, e-pasta sarakste un pielikumi, IT projektu koda repozitorijs, sistēmu sertifikāti un atslēgas, lietotāju paroles un paroļu jaucējvērtības. CERT.LV informē trešās puses, ka jānomaina autentifikācijas dati.' },
        { src: 'media', outlet: 'LSM', date: '02.07.2026', url: 'https://www.lsm.lv/raksts/zinas/latvija/02.07.2026-kiberuzbrukuma-lvm-ielausanas-pazimes-fiksetas-jau-11-junija-premjers-kritize-atbildibas-trukumu.a653577/',
          text: 'Pirmās ielaušanās pazīmes LVM sistēmā fiksētas jau 11. jūnijā, bet aktīvās kaitnieciskās darbības notika 22.–23. jūnija naktī.' }
      ],
      key: { C: { ok: ['P'], half: ['I'] }, I: { ok: ['I'], half: ['N', 'P'] }, A: { ok: ['P'] } },
      explain: {
        C: 'Pierādīts. CERT.LV apstiprina, ka dati ir nopludināti — tas ir tiešs konfidencialitātes pārkāpums (turklāt paroles un atslēgas!).',
        I: 'Iespējams. Nozagtas atslēgas, sertifikāti un paroles ļauj potenciāli viltot vai mainīt datus, un uzbrucējs sistēmā bija ~11 dienas. Tas ir nopietns integritātes RISKS, bet publisku pierādījumu, ka dati tika mainīti, nav.',
        A: 'Pierādīts — nekas nav mainījies, sistēmas joprojām tiek atjaunotas.'
      }
    },
    {
      id: 'lvm-s4', time: '25.07. – 17.08. · Atjaunošana un cēlonis',
      blocks: [
        { src: 'media', outlet: 'LSM', date: '25.07.2026', url: 'https://www.lsm.lv/raksts/zinas/latvija/25.07.2026-atkal-darbojas-kiberuzbrukuma-ietekmeta-lietotne-lvm-geo.a656309/',
          text: 'Atkal darbojas kiberuzbrukumā ietekmētā lietotne “LVM GEO” — vairāk nekā mēnesi pēc uzbrukuma.' },
        { src: 'media', outlet: 'LSM', date: '17.08.2026', url: 'https://www.lsm.lv/raksts/zinas/latvija/17.08.2026-kiberuzbrukums-latvijas-valsts-meziem-parprotot-zimi-uznemums-divus-gadus-nenoversa-ievainojamibu.a659082/',
          text: 'Pārprotot “≥” zīmi drošības ieteikumā, uzņēmums divus gadus nenovērsa ievainojamību: gandrīz visos serveros bija jaunāka versija, bet vienā palika vecā — tieši tas tika kompromitēts. CERT.LV par ievainojamību bija informējis.' }
      ],
      key: { C: { ok: ['P'] }, I: { ok: ['I'], half: ['N', 'P'] }, A: { ok: ['P'] } },
      explain: {
        C: 'Pierādīts (datu noplūde apstiprināta).',
        I: 'Iespējams — joprojām nav publisku faktu par datu izmainīšanu. Informācija par cēloni (“≥” zīme) paskaidro, KĀ notika ielaušanās, bet nepierāda datu izmaiņas.',
        A: 'Pierādīts un ilgstošs — “LVM GEO” nestrādāja vairāk nekā mēnesi. Ilgums palielina A ietekmes līmeni.'
      }
    }
  ],
  sources: [
    { id: 'lvm-src1', src: 'company', outlet: 'LVM paziņojums', date: '2026. g. jūnijs', url: 'https://www.lvm.lv/jaunumi/8018-lvm-saskaries-ar-kiberdrosibas-incidentu',
      quote: 'Drošības nolūkos atslēgtas vairākas ārējās IT sistēmas — “LVM GEO”, karšu pakalpojumu sistēma un medību lietotne “Mednis”, kā arī vairākas iekšējās sistēmas.',
      key: { kind: { ok: ['FAKTS'] }, cia: ['A'] },
      explain: 'FAKTS no paša uzņēmuma. Tas tieši pierāda A ietekmi — lietotāji nevar izmantot sistēmas.' },
    { id: 'lvm-src2', src: 'cert', outlet: 'CERT.LV', date: '2026. g. jūlija sākums', url: 'https://cert.lv/lv/2026/06/as-latvijas-valsts-mezi-kiberdrosibas-incidents-aktuala-informacija',
      quote: 'Uzbrucējs nopludinājis 44 GB datu — iekšējos dokumentus, e-pastus, koda repozitoriju, sistēmu sertifikātus un atslēgas, lietotāju paroles un paroļu jaucējvērtības.',
      key: { kind: { ok: ['FAKTS'] }, cia: ['C'], ciaOpt: ['I'] },
      explain: 'FAKTS no kompetentas institūcijas. Tiešs C pierādījums. Nozagtās atslēgas un paroles rada arī I risku (tāpēc I atzīmēt drīkst, bet tas nav obligāts).' },
    { id: 'lvm-src3', src: 'media', outlet: 'LSM', date: '25.07.2026', url: 'https://www.lsm.lv/raksts/zinas/latvija/25.07.2026-atkal-darbojas-kiberuzbrukuma-ietekmeta-lietotne-lvm-geo.a656309/',
      quote: 'Atkal darbojas kiberuzbrukumā ietekmētā lietotne “LVM GEO”.',
      key: { kind: { ok: ['FAKTS'] }, cia: ['A'] },
      explain: 'FAKTS (sabiedriskais medijs, pārbaudāms). Palīdz novērtēt A ietekmes ILGUMU — vairāk nekā mēnesis.' },
    { id: 'lvm-src4', src: 'expert', outlet: 'Kiberdrošības eksperts (pēc TVNET)', date: '2026. g. jūlijs', url: 'https://www.tvnet.lv/8501794/lvm-datu-noplude-bistamakais-nav-apjoms-bet-saturs-skaidro-eksperts',
      quote: 'LVM datu noplūdē bīstamākais nav apjoms, bet saturs — nopludinātās atslēgas un paroles var izmantot tālākiem uzbrukumiem.',
      key: { kind: { ok: ['EKSP'] }, cia: ['C'], ciaOpt: ['I'] },
      explain: 'EKSPERTA INTERPRETĀCIJA — speciālista vērtējums par sekām. Palīdz saprast C ietekmes smagumu (un iespējamo I risku nākotnē).' },
    { id: 'lvm-src5', src: 'strazdins', outlet: 'Elviss Strazdiņš (pēc LSM)', date: '28.06.2026', url: 'https://www.lsm.lv/raksts/zinas/latvija/28.06.2026-eksperts-hakeris-par-latvijas-valsts-mezu-datu-atsifresanu-sagaida-vairak-neka-600-000-eiro.a652989/',
      quote: 'Parafrāze: par LVM datu atšifrēšanu uzbrucējs prasa 0,1% no uzņēmuma ieņēmumiem — vairāk nekā 600 000 eiro.',
      key: { kind: { ok: ['EKSP', 'NAVP'] }, cia: ['A'], ciaOpt: ['C'] },
      explain: 'Eksperts atstāsta uzbrucēja prasības; LVM tās oficiāli nav apstiprinājis. Tāpēc der gan “Eksperta interpretācija”, gan “Nav pietiekami pierādījumu”. CIA ziņā: “atšifrēšana” norāda uz nošifrētiem datiem → A.' },
    { id: 'lvm-src6', src: 'x', outlet: 'X', date: '26.06.2026', illustrative: true, social: true,
      quote: '🚨 LVM uzlauza, lai sagrozītu Saeimas vēlēšanas! Vēlēšanu rezultāti jau ir iepriekš izmainīti!!!',
      key: { kind: { ok: ['PIEN'], half: ['NAVP'] }, cia: [] },
      explain: 'PIEŅĒMUMS bez pamatojuma. Vēlēšanas vēl nebija notikušas, LVM norāda, ka vēlēšanu sistēma nav skarta, un TVNET Faktomāts šādus apgalvojumus atspēkoja. CIA novērtējumam to NEIZMANTOJAM — īpaši ne kā I pierādījumu.' },
    { id: 'lvm-src7', src: 'threads', outlet: 'Threads', date: '24.06.2026', illustrative: true, social: true,
      quote: '“Mednis” nestrādā jau otro dienu, nevaru reģistrēt medījumu 😤 Kas tur notiek?',
      key: { kind: { ok: ['NAVP', 'FAKTS'] }, cia: ['A'] },
      explain: 'Viena lietotāja pieredze — pati par sevi nav pierādījums, bet tā sakrīt ar LVM oficiālo paziņojumu. Sociālie tīkli var būt noderīgi, ja tos apstiprina uzticams avots. CIA: A.' },
    { id: 'lvm-src8', src: 'anon', outlet: 'Komentārs ziņu portālā', date: '2026. g. jūnijs', illustrative: true, social: true,
      quote: 'Tur jau viss sen bija caurs. Noteikti visi mežu dati ir izmainīti un cirsmas pārdotas par velti!',
      key: { kind: { ok: ['PIEN'] }, cia: [] },
      explain: 'PIEŅĒMUMS — “noteikti” bez neviena fakta. Nav pierādījumu par datu izmaiņām, tāpēc I novērtējumam to neizmantojam.' }
  ],
  extraEvidence: [
    { id: 'lvm-e9', src: 'company', text: 'LVM: vēlēšanu sistēmas izstrāde bija nodalīta un nav skarta.' },
    { id: 'lvm-e10', src: 'media', text: 'LSM: ielaušanās pazīmes fiksētas jau 11. jūnijā; aktīvās darbības — 22.–23. jūnija naktī.' }
  ],
  assessment: {
    id: 'lvm-assess',
    key: {
      ratings: { C: { ok: [3, 4], half: [2] }, I: { ok: [0, 1], half: [2] }, A: { ok: [3, 4], half: [2] } },
      facts: { C: ['lvm-src2', 'lvm-src4', 'lvm-e10'], I: ['lvm-e9', 'lvm-src4', 'lvm-src2'], A: ['lvm-src1', 'lvm-src3', 'lvm-src5', 'lvm-src7'] },
      bad: ['lvm-src6', 'lvm-src8']
    },
    explain: {
      C: 'Augsta/kritiska (3–4). CERT.LV apstiprina 44 GB noplūdi, tostarp paroles, atslēgas un iekšējo saraksti.',
      I: 'Zema vai nav pierādījumu (0–1). Ir integritātes RISKS (nozagtas atslēgas, ilga piekļuve), bet nav publisku faktu, ka dati tika mainīti. Vēlēšanu sistēma nav skarta.',
      A: 'Augsta (3–4). Vairākas ārējās un iekšējās sistēmas atslēgtas; “LVM GEO” atjaunota tikai pēc vairāk nekā mēneša; dati nošifrēti.'
    },
    model: {
      C: 'KONFIDENCIALITĀTE IR ietekmēta, JO CERT.LV apstiprina, ka uzbrucējs nopludinājis 44 GB datu, tostarp paroles un sistēmu atslēgas.',
      I: 'INTEGRITĀTEI ir risks, bet šobrīd NAV pietiekamu pierādījumu, ka dati tika izmainīti — neviens oficiāls avots to neapstiprina.',
      A: 'PIEEJAMĪBA IR ietekmēta, JO sistēmas tika atslēgtas un nošifrētas, un “LVM GEO” atkal darbojās tikai pēc vairāk nekā mēneša.'
    }
  }
};

/* ------------------------------------------------------------------ */
/* 4. CASE 02 — CSDD                                                   */
/* ------------------------------------------------------------------ */

const CSDD = {
  id: 'csdd',
  code: 'CASE 02',
  title: 'CSDD',
  org: 'VAS “Ceļu satiksmes drošības direkcija” (CSDD)',
  period: '2026. gada augusts – septembris',
  tags: ['leak'],
  briefing: {
    title: 'Ziņu apskats: kiberuzbrukums CSDD',
    slides: [
      { t: '13. augusts, 2026', text: 'CSDD paziņo: augusta sākumā tās informācijas sistēma piedzīvojusi sarežģītu kiberuzbrukumu.' },
      { t: 'Kas zināms', text: 'Uzbrucēji daļēji piekļuvuši sistēmai un nelikumīgi ieguvuši vēsturiskus CSDD pakalpojumu maksājumu kvīšu datus, tostarp personas datus.' },
      { t: 'Kas nav skarts', text: 'Klientu lietotājvārdi un paroles nav skarti. CSDD pakalpojumi klātienē un e-CSDD turpina darboties.' },
      { t: 'Kas iesaistīts', text: 'CSDD IT komanda kopā ar CERT.LV uzbrukumu apturējusi; Valsts policija sākusi kriminālprocesu.' },
      { t: 'Tavs uzdevums', text: 'Salīdzini ar LVM: vai šis incidents skar tos pašus CIA elementus? Nepieņem, ka “nopietns” = “viss skarts”.' }
    ],
    video: { label: 'LSM video: “Kiberuzbrukums CSDD: Pašlaik nav signālu par iegūto datu izmantošanu” (14.08.2026)', youtube: 'TbPIG0VvkIw' },
    links: [
      { label: 'LSM: “CSDD cietusi kiberuzbrukumā; klientu lietotājvārdi un paroles nav skarti” (13.08.2026)', url: 'https://www.lsm.lv/raksts/zinas/latvija/13.08.2026-csdd-cietusi-kiberuzbrukuma-klientu-lietotaju-vardi-un-paroles-nav-skarti.a658680/' },
      { label: 'LSM video YouTube', url: 'https://www.youtube.com/watch?v=TbPIG0VvkIw' }
    ]
  },
  stages: [
    {
      id: 'csdd-s0', time: '13.08. · CSDD paziņojums',
      blocks: [
        { src: 'company', outlet: 'CSDD paziņojums', date: '13.08.2026', url: 'https://www.csdd.lv/jaunumi/csdd-saskaries-ar-kiberdrosibas-incidentu',
          text: 'Uzbrucēji daļēji piekļuvuši IT sistēmai un nelikumīgi ieguvuši vēsturiskus CSDD pakalpojumu maksājumu kvīšu datus, tostarp personas datus. Klientu lietotājvārdi un paroles nav skarti. Pakalpojumi klātienē un e-CSDD darbojas.' }
      ],
      key: { C: { ok: ['P'], half: ['I'] }, I: { ok: ['N'], half: ['I'] }, A: { ok: ['N'], half: ['I'] } },
      explain: {
        C: 'Pierādīts. Pati iestāde apstiprina, ka dati “nelikumīgi iegūti”. Apjoms vēl nav zināms, bet pats fakts — ir.',
        I: 'Nav pierādījumu. Nekas neliecina, ka dati mainīti. Kiberuzbrukums pats par sevi NEnozīmē integritātes pārkāpumu.',
        A: 'Nav pierādījumu. Pakalpojumi darbojas — lietotāji var izmantot e-CSDD un klātienes pakalpojumus.'
      }
    },
    {
      id: 'csdd-s1', time: '14.08. · CERT.LV un sociālie tīkli',
      blocks: [
        { src: 'cert', outlet: 'CERT.LV (pēc LSM)', date: '14.08.2026', url: 'https://www.lsm.lv/raksts/zinas/latvija/14.08.2026-kiberuzbrukums-csdd-paslaik-nav-signalu-par-ieguto-datu-izmantosanu.a658775/',
          text: 'Iegūto datu apjoms ir liels un tiek precizēts. Pašlaik nav signālu, ka iegūtie dati jau būtu izmantoti. Uzbrukums nebija nejaušs, bet plānots.' },
        { src: 'x', outlet: 'X', date: '14.08.2026', illustrative: true,
          text: 'CSDD uzlauzts — tagad hakeri var pārrakstīt tavas auto reģistrācijas un vadītāja apliecības! Pārbaudiet savus datus, kamēr nav par vēlu!!!' }
      ],
      key: { C: { ok: ['P'] }, I: { ok: ['N'], half: ['I'] }, A: { ok: ['N'], half: ['I'] } },
      explain: {
        C: 'Pierādīts — CERT.LV apstiprina lielu iegūto datu apjomu.',
        I: 'Nav pierādījumu. X ieraksts izsaka bailes, bet nesniedz nevienu faktu par to, ka reģistrā kaut kas mainīts. Skaļš ieraksts ≠ pierādījums.',
        A: 'Nav pierādījumu — pakalpojumi darbojas.'
      }
    },
    {
      id: 'csdd-s2', time: '18.08. · Apjoms noskaidrots',
      blocks: [
        { src: 'cert', outlet: 'CERT.LV (pēc LSM)', date: '18.08.2026', url: 'https://www.lsm.lv/raksts/zinas/latvija/18.08.2026-kiberuzbrukuma-csdd-ieguti-12-miljonu-cilveku-personas-dati.a659324/',
          text: 'Iegūti 1,2 miljonu cilvēku personas dati no maksājumiem kopš 2008. gada: personas kodi, vārdi, uzvārdi vai uzņēmumu nosaukumi, maksājumu summas un datumi, transportlīdzekļu numuri un adreses. Skarti arī ~150–200 tūkst. juridisku personu.' },
        { src: 'threads', outlet: 'Threads', date: '18.08.2026', illustrative: true,
          text: 'Man vakar zvanīja “no CSDD” un lūdza apstiprināt bankas kartes datus. Tas jau sākas…' }
      ],
      key: { C: { ok: ['P'] }, I: { ok: ['N'], half: ['I'] }, A: { ok: ['N'], half: ['I'] } },
      explain: {
        C: 'Pierādīts, un tagad zināms arī apjoms — viens no lielākajiem datu noplūdes gadījumiem Latvijā. C ietekme ir kritiska.',
        I: 'Nav pierādījumu. Krāpnieku zvani CSDD vārdā ir C noplūdes SEKAS (dati tiek izmantoti), nevis pierādījums, ka CSDD dati izmainīti.',
        A: 'Nav pierādījumu.'
      }
    },
    {
      id: 'csdd-s3', time: '19.–20.08. · Precizējumi',
      blocks: [
        { src: 'media', outlet: 'LSM', date: '19.08.2026', url: 'https://www.lsm.lv/raksts/zinas/latvija/19.08.2026-kiberuzbrukums-csdd-nedela-parbaudes-vadibas-atbildiba-un-ko-darit-klientiem.a659527/',
          text: 'Iegūtie dati netika dzēsti vai bojāti, CSDD pakalpojumi turpina darboties. Visa CSDD vadība atkāpjas no amata; Ģenerālprokuratūra un Datu valsts inspekcija veic pārbaudes.' },
        { src: 'media', outlet: 'LSM', date: '20.08.2026', url: 'https://www.lsm.lv/raksts/zinas/latvija/20.08.2026-kiberuzbrukuma-csdd-datiem-nav-ieguti-klientu-telefona-numuri-e-pasta-adreses-un-bankas-dati.a659630/',
          text: 'CSDD: nav iegūti klientu telefona numuri, e-pasta adreses, bankas dati un e-CSDD piekļuves dati.' }
      ],
      key: { C: { ok: ['P'] }, I: { ok: ['N'] }, A: { ok: ['N'] } },
      explain: {
        C: 'Pierādīts. Precizējums sašaurina, KĀDI dati noplūda, bet nemaina to, ka C ir pārkāpta.',
        I: 'Nav pierādījumu — un tagad ir pat pretējs fakts: dati netika dzēsti vai bojāti.',
        A: 'Nav pierādījumu — pakalpojumi darbojās visu laiku. Vadības atkāpšanās liecina par incidenta nopietnību, bet nav A ietekme.'
      }
    },
    {
      id: 'csdd-s4', time: '18.09. · Komisijas secinājumi',
      blocks: [
        { src: 'official', outlet: 'Satiksmes ministrijas komisija (pēc LSM)', date: '18.09.2026', url: 'https://www.lsm.lv/raksts/zinas/latvija/18.09.2026-satiksmes-ministrijas-komisija-par-kiberuzbrukumu-csdd-truka-drosibas-parbauzu-un-tikla-aizsardzibas.a663754/',
          text: 'Ieeja uzbrucējam bija CSDD tīmekļa lietotne “med.csdd.lv”, kur pietika ar lietotājvārdu un paroli bez daudzfaktoru autentifikācijas. Trūka drošības pārbaužu un tīkla aizsardzības; CERT.LV agrīnās brīdināšanas sistēma nebija pieslēgta.' }
      ],
      key: { C: { ok: ['P'] }, I: { ok: ['N'] }, A: { ok: ['N'] } },
      explain: {
        C: 'Pierādīts. Cēloņa noskaidrošana (nav MFA) paskaidro, KĀ notika zādzība.',
        I: 'Nav pierādījumu. Cēlonis nav pierādījums par datu izmaiņām.',
        A: 'Nav pierādījumu.'
      }
    }
  ],
  sources: [
    { id: 'csdd-src1', src: 'company', outlet: 'CSDD paziņojums', date: '13.08.2026', url: 'https://www.csdd.lv/jaunumi/csdd-saskaries-ar-kiberdrosibas-incidentu',
      quote: 'Uzbrucēji daļēji piekļuva IT sistēmai un nelikumīgi ieguva vēsturiskus maksājumu kvīšu datus, tostarp personas datus. Klientu lietotājvārdi un paroles nav skarti.',
      key: { kind: { ok: ['FAKTS'] }, cia: ['C'] },
      explain: 'FAKTS no pašas iestādes — tiešs C pierādījums.' },
    { id: 'csdd-src2', src: 'cert', outlet: 'CERT.LV (pēc LSM)', date: '18.08.2026', url: 'https://www.lsm.lv/raksts/zinas/latvija/18.08.2026-kiberuzbrukuma-csdd-ieguti-12-miljonu-cilveku-personas-dati.a659324/',
      quote: 'Iegūti 1,2 miljonu cilvēku personas dati — personas kodi, vārdi, uzvārdi, maksājumi, transportlīdzekļu numuri un adreses.',
      key: { kind: { ok: ['FAKTS'] }, cia: ['C'] },
      explain: 'FAKTS no kompetentas institūcijas — parāda C ietekmes APJOMU (kritisks).' },
    { id: 'csdd-src3', src: 'media', outlet: 'LSM', date: '19.08.2026', url: 'https://www.lsm.lv/raksts/zinas/latvija/19.08.2026-kiberuzbrukums-csdd-nedela-parbaudes-vadibas-atbildiba-un-ko-darit-klientiem.a659527/',
      quote: 'CSDD pakalpojumi klātienē un e-CSDD turpina darboties.',
      key: { kind: { ok: ['FAKTS'] }, cia: ['A'] },
      explain: 'FAKTS. Svarīgs A novērtējumam — tas pierāda, ka pieejamība NAV ietekmēta. Arī “nav ietekmes” ir CIA secinājums, kam vajag faktu.' },
    { id: 'csdd-src4', src: 'expert', outlet: 'CERT.LV eksperts (pēc LSM)', date: '14.08.2026', url: 'https://www.lsm.lv/raksts/zinas/latvija/14.08.2026-kiberuzbrukums-csdd-paslaik-nav-signalu-par-ieguto-datu-izmantosanu.a658775/',
      quote: 'Iegūtos datus var izmantot mērķētai krāpšanai — zvani un e-pasti CSDD vārdā izskatīsies daudz ticamāki. Neapstipriniet pieprasījumus, kurus neesat paši iniciējuši.',
      key: { kind: { ok: ['EKSP'] }, cia: ['C'] },
      explain: 'EKSPERTA INTERPRETĀCIJA par sekām. Palīdz novērtēt, cik smaga ir C ietekme cilvēkiem.' },
    { id: 'csdd-src5', src: 'strazdins', outlet: 'Elviss Strazdiņš (pēc Jauns.lv)', date: '2026. g. augusts', url: 'https://jauns.lv/raksts/zinas/724528-par-kadu-summu-nu-tirgos-latvijas-iedzivotaju-datus-elvisa-strazdina-teiktais-par-csdd-kiber-misekli-uzdzen-gan-bailes-gan-dusmas',
      quote: 'Parafrāze: nozagtās datubāzes vispirms nonāk pie datu brokeriem, kuri tās sakārto un pārdod tālāk interneta noziedzniekiem. Eksperts to nosauc par lielāko datu zādzību Latvijā.',
      key: { kind: { ok: ['EKSP'] }, cia: ['C'] },
      explain: 'EKSPERTA INTERPRETĀCIJA — skaidro, kas parasti notiek ar nozagtiem datiem. Tā nav apstiprināta informācija par konkrētajiem CSDD datiem, bet palīdz novērtēt C ietekmes smagumu.' },
    { id: 'csdd-src6', src: 'x', outlet: 'X', date: '14.08.2026', illustrative: true, social: true,
      quote: 'CSDD uzlauzts — tagad hakeri var pārrakstīt tavas auto reģistrācijas un vadītāja apliecības!',
      key: { kind: { ok: ['PIEN'], half: ['NAVP'] }, cia: [] },
      explain: 'PIEŅĒMUMS. Nav neviena fakta par izmaiņām reģistrā; CSDD norāda, ka dati netika dzēsti vai bojāti. Nelieto to kā I pierādījumu.' },
    { id: 'csdd-src7', src: 'threads', outlet: 'Threads', date: '18.08.2026', illustrative: true, social: true,
      quote: 'Man vakar zvanīja “no CSDD” un lūdza apstiprināt bankas kartes datus. Tas jau sākas…',
      key: { kind: { ok: ['NAVP'], half: ['FAKTS'] }, cia: [], ciaOpt: ['C'] },
      explain: 'Viena cilvēka pieredze — NAV PIETIEKAMI PIERĀDĪJUMU, lai gan krāpšana CSDD vārdā ir reāls risks (CERT.LV augustā brīdināja par krāpšanu). Svarīgi: krāpnieku zvans NAV pierādījums, ka CSDD dati izmainīti (I). Tās ir iespējamās C noplūdes sekas.' },
    { id: 'csdd-src8', src: 'anon', outlet: 'Komentārs ziņu portālā', date: '2026. g. augusts', illustrative: true, social: true,
      quote: 'Visu CSDD sistēmu nošifrēja, tāpēc tagad rindas nodaļās un nekas nestrādā!',
      key: { kind: { ok: ['PIEN'] }, cia: [] },
      explain: 'PIEŅĒMUMS, ko atspēko fakti: pakalpojumi darbojās. Datu noplūdi nevajag automātiski uzskatīt par A problēmu.' }
  ],
  extraEvidence: [
    { id: 'csdd-e9', src: 'media', text: 'LSM: iegūtie dati netika dzēsti vai bojāti.' },
    { id: 'csdd-e10', src: 'media', text: 'Mediji: CERT.LV par uzbrukumu informēts tikai 10. augusta vakarā — trešajā dienā pēc ielaušanās.' }
  ],
  assessment: {
    id: 'csdd-assess',
    key: {
      ratings: { C: { ok: [3, 4], half: [2] }, I: { ok: [0], half: [1] }, A: { ok: [0], half: [1] } },
      facts: { C: ['csdd-src1', 'csdd-src2', 'csdd-src4', 'csdd-src5'], I: ['csdd-e9'], A: ['csdd-src3'] },
      bad: ['csdd-src6', 'csdd-src8']
    },
    explain: {
      C: 'Kritiska (4) vai augsta (3). 1,2 miljonu cilvēku personas kodi, adreses un auto numuri — tos var izmantot krāpšanai gadiem.',
      I: 'Nav pierādījumu (0). Oficiāli: dati netika dzēsti vai bojāti. “Hakeri var pārrakstīt reģistru” ir tikai X apgalvojums.',
      A: 'Nav pierādījumu (0). Pakalpojumi klātienē un e-CSDD darbojās. Nopietns incidents ≠ pieejamības incidents.'
    },
    model: {
      C: 'KONFIDENCIALITĀTE IR ietekmēta (kritiski), JO CERT.LV un CSDD apstiprina 1,2 miljonu cilvēku personas datu iegūšanu.',
      I: 'INTEGRITĀTE NAV ietekmēta pēc pieejamās informācijas, JO dati netika dzēsti vai bojāti un nav faktu par izmaiņām.',
      A: 'PIEEJAMĪBA NAV ietekmēta, JO CSDD pakalpojumi klātienē un e-CSDD turpināja darboties.'
    }
  }
};

/* ------------------------------------------------------------------ */
/* 5. CASE 03 — DDoS pret valsts vietnēm                               */
/* ------------------------------------------------------------------ */

const DDOS = {
  id: 'ddos',
  code: 'CASE 03',
  title: 'VALSTS VIETNES (DDoS)',
  org: 'Valsts un pašvaldību tīmekļa vietnes (LVRTC infrastruktūra)',
  period: '2025. gada 2. oktobris',
  tags: ['ddos'],
  briefing: {
    title: 'Ziņu apskats: DDoS uzbrukums valsts vietnēm',
    slides: [
      { t: '2. oktobris, 2025, rīts', text: 'Latvijas valsts un pašvaldību tīmekļa vietnes piedzīvo apjomīgu DDoS (pakalpojumu atteices) uzbrukumu.' },
      { t: 'Kas nestrādā', text: 'Traucējumi vid.gov.lv, Latvija.lv, mk.gov.lv, ministriju un pašvaldību vietnēs; lietotājiem nav pieejams arī eParaksts.lv.' },
      { t: 'Kas ir DDoS', text: 'Tūkstošiem datoru vienlaikus sūta pieprasījumus, lai pārslogotu serverus. Mērķis — lai īstie lietotāji netiktu klāt.' },
      { t: 'Tavs uzdevums', text: 'Šis ir īss gadījums. Salīdzini to ar LVM un CSDD: kurš CIA elements šeit ir galvenais?' }
    ],
    links: [
      { label: 'LVRTC: “Pakalpojumu atteices uzbrukums valsts resursiem 2. oktobrī”', url: 'https://www.lvrtc.lv/jaunumi/jaunumi/ddos-valsts-resursiem-2-10/' },
      { label: 'Sargs.lv: “Valsts interneta mājaslapas piedzīvo apjomīgu DDoS uzbrukumu” (02.10.2025)', url: 'https://www.sargs.lv/lv/latvija/2025-10-02/valsts-interneta-majaslapas-piedzivo-apjomigu-ddos-uzbrukumu' }
    ]
  },
  stages: [
    {
      id: 'ddos-s0', time: '02.10. rīts · Pirmā ziņa',
      blocks: [
        { src: 'media', outlet: 'Sargs.lv / LETA', date: '02.10.2025', url: 'https://www.sargs.lv/lv/latvija/2025-10-02/valsts-interneta-majaslapas-piedzivo-apjomigu-ddos-uzbrukumu',
          text: 'Valsts un pašvaldību mājaslapas piedzīvo apjomīgu DDoS uzbrukumu. Traucējumi VID, Latvija.lv, Ministru kabineta, ministriju un pašvaldību vietnēs; nav pieejams eParaksts.lv.' }
      ],
      key: { C: { ok: ['N'], half: ['I'] }, I: { ok: ['N'], half: ['I'] }, A: { ok: ['P'] } },
      explain: {
        C: 'Nav pierādījumu. DDoS pārslogo serverus, bet pats par sevi nenozīmē datu zādzību.',
        I: 'Nav pierādījumu. Nav ziņu par izmainītu saturu.',
        A: 'Pierādīts — vietnes un eParaksts nav pieejami.'
      }
    },
    {
      id: 'ddos-s1', time: '02.10. · LVRTC paziņojums un X',
      blocks: [
        { src: 'official', outlet: 'LVRTC', date: '02.10.2025', url: 'https://www.lvrtc.lv/jaunumi/jaunumi/ddos-valsts-resursiem-2-10/',
          text: 'Pieprasījumu skaits sasniedza ~2 miljonus sekundē, no daudzu valstu IP adresēm. Stundas laikā atjaunota visu resursu pieejamība un darbība. Datu noplūde vai cita veida resursu kompromitēšana nav notikusi.' },
        { src: 'x', outlet: 'X', date: '02.10.2025', illustrative: true,
          text: 'Hakeri iekļuva VID datubāzēs un nozaga VISU nodokļu maksātāju datus!!! Mainiet paroles!' }
      ],
      key: { C: { ok: ['N'] }, I: { ok: ['N'] }, A: { ok: ['P'] } },
      explain: {
        C: 'Nav pierādījumu — un ir pretējs fakts: LVRTC apstiprina, ka datu noplūde nav notikusi. X ieraksts nav pierādījums.',
        I: 'Nav pierādījumu — resursu kompromitēšana nav notikusi.',
        A: 'Pierādīts. Ilgums ~1 stunda — tas palīdz noteikt ietekmes līmeni.'
      }
    },
    {
      id: 'ddos-s2', time: 'Oktobris · Izpētes secinājumi',
      blocks: [
        { src: 'media', outlet: 'Apollo / LETA', date: '2025. g. oktobris', url: 'https://www.apollo.lv/8341948/valsts-un-pasvaldibu-majaslapu-kiberuzbrukuma-izpete-konstatetas-aizsardzibas-mehanisma-konfiguracijas-kludas',
          text: 'Uzbrukuma izpētē konstatētas aizsardzības mehānisma konfigurācijas kļūdas, kuru dēļ mazinājās aizsardzības efektivitāte.' }
      ],
      key: { C: { ok: ['N'] }, I: { ok: ['N'] }, A: { ok: ['P'] } },
      explain: {
        C: 'Nav pierādījumu. Konfigurācijas kļūda aizsardzībā paskaidro, kāpēc DDoS izdevās, bet nenorāda uz datu zādzību.',
        I: 'Nav pierādījumu.',
        A: 'Pierādīts. Šis ir “tīrs” pieejamības incidents.'
      }
    }
  ],
  sources: [
    { id: 'ddos-src1', src: 'official', outlet: 'LVRTC', date: '02.10.2025', url: 'https://www.lvrtc.lv/jaunumi/jaunumi/ddos-valsts-resursiem-2-10/',
      quote: 'Stundas laikā atjaunota visu resursu pieejamība un darbība.',
      key: { kind: { ok: ['FAKTS'] }, cia: ['A'] },
      explain: 'FAKTS no infrastruktūras uzturētāja. Parāda A ietekmi un tās ilgumu (~1 h).' },
    { id: 'ddos-src2', src: 'official', outlet: 'LVRTC', date: '02.10.2025', url: 'https://www.lvrtc.lv/jaunumi/jaunumi/ddos-valsts-resursiem-2-10/',
      quote: 'Datu noplūde vai cita veida resursu kompromitēšana nav notikusi.',
      key: { kind: { ok: ['FAKTS'] }, cia: ['C', 'I'] },
      explain: 'FAKTS, kas ļauj pamatot, ka C un I NAV ietekmētas. Pierādījums par “nav ietekmes” ir tikpat svarīgs kā par “ir ietekme”.' },
    { id: 'ddos-src3', src: 'x', outlet: 'X', date: '02.10.2025', illustrative: true, social: true,
      quote: 'Hakeri iekļuva VID datubāzēs un nozaga VISU nodokļu maksātāju datus!!!',
      key: { kind: { ok: ['PIEN'], half: ['NAVP'] }, cia: [] },
      explain: 'PIEŅĒMUMS, ko atspēko oficiālais avots. DDoS nav datu zādzība.' },
    { id: 'ddos-src4', src: 'media', outlet: 'Apollo / LETA', date: '2025. g. oktobris', url: 'https://www.apollo.lv/8341948/valsts-un-pasvaldibu-majaslapu-kiberuzbrukuma-izpete-konstatetas-aizsardzibas-mehanisma-konfiguracijas-kludas',
      quote: 'Izpētē konstatētas aizsardzības mehānisma konfigurācijas kļūdas.',
      key: { kind: { ok: ['FAKTS'], half: ['EKSP'] }, cia: [], ciaOpt: ['A'] },
      explain: 'FAKTS par CĒLONI. Tas paskaidro, kāpēc uzbrukums izdevās, bet pats neparāda ietekmi uz C, I vai A. Ne katrs patiess fakts ir CIA ietekmes pierādījums.' }
  ],
  extraEvidence: [
    { id: 'ddos-e5', src: 'media', text: 'Sargs.lv: traucējumi VID, Latvija.lv, MK, ministriju un pašvaldību vietnēs; eParaksts.lv nav pieejams.' }
  ],
  assessment: {
    id: 'ddos-assess',
    key: {
      ratings: { C: { ok: [0], half: [1] }, I: { ok: [0], half: [1] }, A: { ok: [2, 3], half: [1, 4] } },
      facts: { C: ['ddos-src2'], I: ['ddos-src2'], A: ['ddos-src1', 'ddos-e5'] },
      bad: ['ddos-src3']
    },
    explain: {
      C: 'Nav pierādījumu (0). LVRTC: datu noplūde nav notikusi.',
      I: 'Nav pierādījumu (0). LVRTC: resursu kompromitēšana nav notikusi.',
      A: 'Vidēja/augsta (2–3). Daudzas valsts vietnes un eParaksts nebija pieejami, bet darbība atjaunota ~1 stundas laikā.'
    },
    model: {
      C: 'KONFIDENCIALITĀTE NAV ietekmēta, JO LVRTC apstiprina, ka datu noplūde nav notikusi.',
      I: 'INTEGRITĀTE NAV ietekmēta, JO resursu kompromitēšana nav notikusi un nav ziņu par izmainītu saturu.',
      A: 'PIEEJAMĪBA IR ietekmēta, JO DDoS dēļ valsts vietnes un eParaksts ~1 stundu nebija pieejami.'
    }
  }
};

/* ------------------------------------------------------------------ */
/* 6. CIA DETEKTĪVS                                                    */
/* ------------------------------------------------------------------ */

const BINS = ['C', 'I', 'A', 'C+I', 'C+A', 'I+A', 'C+I+A'];

const DETECTIVE = {
  id: 'det',
  cards: [
    { id: 'd1', text: 'Nozagti 20 000 klientu ieraksti.', key: 'C', tags: ['leak'],
      explain: 'Tikai datu iegūšana → C.' },
    { id: 'd2', text: 'Uzbrucējs izmaina klientu kontu atlikumus.', key: 'I',
      explain: 'Dati izmainīti → I.' },
    { id: 'd3', text: 'Serveris nestrādā 6 stundas.', key: 'A',
      explain: 'Nav pieejams → A.' },
    { id: 'd4', text: 'Nozagti dati un serveri nošifrēti.', key: 'C+A', tags: ['ransomware'],
      explain: 'Zādzība → C, nošifrēti serveri → A.' },
    { id: 'd5', text: 'Uzbrucējs iegūst datubāzi, izmaina tās saturu un pēc tam sistēmu izslēdz.', key: 'C+I+A',
      explain: 'Iegūst → C, izmaina → I, izslēdz → A.' },
    { id: 'd6', text: 'Ransomware nošifrē grāmatvedības serveri. Datu nokopēšana nav konstatēta.', key: 'A', tags: ['ransomware'],
      explain: 'Nošifrēts → A. Bez pierādījumiem par nokopēšanu C nepievienojam.' },
    { id: 'd7', text: 'Uzbrucējs e-veikalā nomaina visu preču cenas uz 0,01 €.', key: 'I',
      explain: 'Neatļauti izmainīta informācija → I.' },
    { id: 'd8', text: 'Uzbrucējs lasa direktora e-pastus un izmaina tos pirms nosūtīšanas.', key: 'C+I',
      explain: 'Lasa → C, izmaina → I.' },
    { id: 'd9', text: 'DDoS uzbrukums: e-pakalpojumu portāls 3 stundas nav sasniedzams.', key: 'A', tags: ['ddos'],
      explain: 'Pārslodze → A.' },
    { id: 'd10', text: 'Uzbrucējs izdzēš e-žurnāla atzīmes; tās nav redzamas, kamēr tās neatjauno no rezerves kopijas.', key: 'I+A',
      explain: 'Dati neatļauti izdzēsti (izmainīti) → I; kamēr nav atjaunoti, nav pieejami → A.' },
    { id: 'd11', text: 'Nopludināti 5000 lietotāju e-pasti un paroļu jaucējvērtības (hash).', key: 'C', tags: ['leak'],
      explain: 'Slepena informācija nonāca pie nepiederošiem → C.' },
    { id: 'd12', text: 'Pacientu kartes publicētas internetā; slimnīcas sistēmas darbojas normāli.', key: 'C', tags: ['leak'],
      explain: 'Noplūde → C. Sistēmas darbojas, tāpēc A nav skarta.' },
    { id: 'd13', text: 'Vīruss sabojā rēķinu datubāzi — daļa summu kļūst nepareizas, un sistēma 2 dienas netiek lietota, kamēr datus pārbauda.', key: 'I+A',
      explain: 'Nepareizas summas → I, sistēma nelietojama → A.' },
    { id: 'd14', text: 'Uzbrucējs nozog klientu datubāzi, un pēc tam DDoS uz 2 dienām nogāž e-veikalu.', key: 'C+A', tags: ['leak'],
      explain: 'Zādzība → C, e-veikals nav pieejams → A.' },
    { id: 'd15', text: 'Uzbrucējs nomaina bankas kontu piegādātāja rēķinā un vienlaikus ar DDoS nogāž klientu portālu.', key: 'I+A',
      explain: 'Izmainīts rēķins → I, portāls nav pieejams → A.' },
    { id: 'd16', text: 'Darbinieks pa kļūdu nosūta klientu sarakstu ar personas kodiem ārējam adresātam.', key: 'C', tags: ['leak'],
      explain: 'Informācija nonāca pie nepiederošā → C.' },
    { id: 'd17', text: 'Uzbrucējs iegūst administratora paroli, ielogojas un maina ugunsmūra noteikumus.', key: 'C+I',
      explain: 'Paroles kompromitēšana → C, konfigurācijas izmaiņas → I.' },
    { id: 'd18', text: 'Uzlauztā pašvaldības mājaslapā parādās viltots paziņojums par “ūdens piegādes pārtraukumu”.', key: 'I',
      explain: 'Viltots saturs → I. Lapa strādā; informācija nav nozagta.' }
  ]
};

/* ------------------------------------------------------------------ */
/* 7. SALĪDZINĀJUMS LVM vs CSDD                                        */
/* ------------------------------------------------------------------ */

const COMPARE = {
  table: {
    id: 'cmp-table', type: 'compare', cat: 'cases',
    cases: ['lvm', 'csdd'],
    key: {
      lvm: { C: { ok: ['P'] }, I: { ok: ['I'], half: ['N', 'P'] }, A: { ok: ['P'] } },
      csdd: { C: { ok: ['P'] }, I: { ok: ['N'], half: ['I'] }, A: { ok: ['N'], half: ['I'] } }
    },
    explain: {
      lvm: { C: 'Pierādīts — 44 GB noplūde (CERT.LV).', I: 'Iespējams — risks, bet nav faktu par izmaiņām.', A: 'Pierādīts — sistēmas atslēgtas, nošifrētas, atjaunotas pēc nedēļām.' },
      csdd: { C: 'Pierādīts — 1,2 milj. cilvēku dati.', I: 'Nav pierādījumu — dati netika dzēsti vai bojāti.', A: 'Nav pierādījumu — pakalpojumi darbojās.' }
    }
  },
  questions: [
    {
      id: 'cmp-q1', type: 'single', cat: 'cases',
      prompt: 'Kurā incidentā ir pierādījumi par Confidentiality pārkāpumu?',
      choices: [['LVM', 'Tikai LVM'], ['CSDD', 'Tikai CSDD'], ['BOTH', 'Abos'], ['NONE', 'Nevienā']],
      key: ['BOTH'],
      explain: 'Abos. LVM — CERT.LV apstiprināta 44 GB noplūde; CSDD — 1,2 miljonu cilvēku personas dati.'
    },
    {
      id: 'cmp-q2', type: 'single', cat: 'cases', tags: ['leakA'],
      prompt: 'Kur ir pierādījumi par Availability ietekmi?',
      choices: [['LVM', 'Tikai LVM'], ['CSDD', 'Tikai CSDD'], ['BOTH', 'Abos'], ['NONE', 'Nevienā']],
      key: ['LVM'],
      explain: 'Tikai LVM. CSDD pakalpojumi darbojās visu laiku — liela datu noplūde nav pieejamības incidents.'
    },
    {
      id: 'cmp-q3', type: 'single', cat: 'cases', tags: ['inoev'],
      prompt: 'Vai mums ir pietiekami pierādījumi, lai apgalvotu, ka Integrity ir pārkāpta?',
      choices: [['LVM', 'Jā — LVM'], ['CSDD', 'Jā — CSDD'], ['BOTH', 'Jā — abos'], ['NONE', 'Nē — NAV PIETIEKAMU DATU']],
      key: ['NONE'],
      explain: 'Nē. LVM gadījumā ir nopietns integritātes RISKS (nozagtas atslēgas, ilga piekļuve), bet nav publisku faktu par datu izmaiņām. CSDD — dati netika dzēsti vai bojāti. Nevajag “izdomāt” I pārkāpumu tikai tāpēc, ka noticis kiberuzbrukums.'
    },
    {
      id: 'cmp-q4', type: 'single', cat: 'cases',
      prompt: 'CSDD incidents bija viens no nopietnākajiem Latvijā. Kāpēc tas tomēr NAV Availability incidents?',
      choices: [
        ['a', 'Jo pakalpojumi turpināja darboties — incidenta nopietnība ir C dimensijā'],
        ['b', 'Jo dati netika nošifrēti — tātad incidents nav nopietns'],
        ['c', 'Jo CERT.LV incidentu vēl nav apstiprinājis'],
        ['d', 'Tas IR Availability incidents, jo vadība atkāpās']
      ],
      key: ['a'],
      explain: 'Nopietnība un CIA elements ir dažādas lietas. CSDD incidents ir kritisks C incidents, bet lietotāji varēja izmantot pakalpojumus, tāpēc A nav skarta.'
    }
  ]
};

/* ------------------------------------------------------------------ */
/* 8. NOSLĒGUMA UZDEVUMS (izdomāts incidents)                          */
/* ------------------------------------------------------------------ */

const FINAL = {
  id: 'final',
  title: 'CASE X — SIA “Rīvas ūdens”',
  note: 'Izdomāts incidents mācību nolūkam. Uzņēmums un notikumi nav reāli.',
  intro: 'SIA “Rīvas ūdens” ir pašvaldības ūdenssaimniecības uzņēmums ar ~12 000 klientu. Pirmdien no rīta klienti sāk zvanīt: e-pastā saņemtajos septembra rēķinos norādīts cits bankas konta numurs nekā parasti.',
  blocks: [
    { src: 'company', outlet: 'Uzņēmuma paziņojums', date: 'Pirmdiena, 10:15',
      text: 'Konstatēta neatļauta piekļuve rēķinu sagatavošanas sistēmai. 3 400 septembra rēķinos uzbrucējs nomainīja saņēmēja bankas kontu. Klientu portāls “Mans ūdens” drošības nolūkos izslēgts, kamēr sistēma tiek pārbaudīta. Ūdens piegāde nav traucēta.' },
    { src: 'cert', outlet: 'CERT.LV', date: 'Pirmdiena, 13:00',
      text: 'Incidents tiek izmeklēts. Pagaidām nav pierādījumu, ka klientu datubāze būtu izgūta; žurnālfaili tiek analizēti.' },
    { src: 'telegram', outlet: 'Anonīms Telegram kanāls', date: 'Pirmdiena, 15:30', illustrative: true,
      text: 'Mums ir VISI Rīvas ūdens klientu dati. Drīz publicēsim! Tas pats grupējums, kas uzlauza LVM.' },
    { src: 'expert', outlet: 'Kiberdrošības eksperts (reģionālais medijs)', date: 'Otrdiena',
      text: 'Ja uzbrucējs varēja mainīt rēķinus, viņš, iespējams, varēja arī lasīt klientu datus. Tas jāpārbauda žurnālfailos.' },
    { src: 'media', outlet: 'Reģionālais medijs', date: 'Otrdiena, 16:00',
      text: 'Klientu portāls “Mans ūdens” atjaunots pēc ~30 stundām. Uzņēmums apstiprina: vismaz 40 klienti paspēja samaksāt uz krāpnieku kontu.' }
  ],
  statements: [
    { id: 'k1', text: 'Uzbrucējs ieguva piekļuvi rēķinu sagatavošanas sistēmai.', key: 'known' },
    { id: 'k2', text: '3 400 rēķinos nomainīts saņēmēja bankas konts.', key: 'known' },
    { id: 'k3', text: 'Uzbrucējs nozaga visu klientu datubāzi.', key: 'unproven', social: true },
    { id: 'k4', text: 'Klientu portāls bija izslēgts ~30 stundas.', key: 'known' },
    { id: 'k5', text: 'Uzbrukumu veica tas pats grupējums, kas uzbruka LVM.', key: 'unproven', social: true },
    { id: 'k6', text: 'Ūdens piegāde klientiem nav traucēta.', key: 'known' },
    { id: 'k7', text: 'Klientu dati drīz tiks publicēti internetā.', key: 'unproven', social: true },
    { id: 'k8', text: 'Vismaz 40 klienti samaksāja uz krāpnieku kontu.', key: 'known' }
  ],
  key: {
    status: { C: { ok: ['I'], half: ['N'] }, I: { ok: ['P'] }, A: { ok: ['P'], half: ['I'] } },
    ratings: { C: { ok: [0, 1], half: [2] }, I: { ok: [3, 4], half: [2] }, A: { ok: [2], half: [1, 3] } }
  },
  explain: {
    C: 'Iespējams, bet NAV pierādīts (vērtējums 0–1). CERT.LV: pagaidām nav pierādījumu par datubāzes izgūšanu. Telegram apgalvojums nav pierādījums. Jāpieprasa žurnālfailu analīzes rezultāti.',
    I: 'Pierādīts (3–4). Uzņēmums apstiprina 3 400 izmainītus rēķinus, un klienti jau zaudējuši naudu.',
    A: 'Pierādīts (2). Klientu portāls nestrādāja ~30 stundas, bet galvenais pakalpojums — ūdens piegāde — netika traucēts.'
  },
  model: {
    C: 'KONFIDENCIALITĀTE — šobrīd NAV pietiekamu pierādījumu. Iespējams, jo uzbrucējam bija piekļuve, bet CERT.LV vēl nav konstatējis datu izgūšanu.',
    I: 'INTEGRITĀTE IR ietekmēta, JO uzņēmums apstiprina, ka 3 400 rēķinos nomainīts bankas konts.',
    A: 'PIEEJAMĪBA IR ietekmēta (vidēji), JO klientu portāls ~30 stundas nebija pieejams, lai gan ūdens piegāde turpinājās.'
  }
};

/* ------------------------------------------------------------------ */
/* KĻŪDU TIPI (pedagoga panelim)                                       */
/* ------------------------------------------------------------------ */

const ERROR_TYPES = {
  IA_MIX: 'sajauca Integrity ar Availability',
  CI_MIX: 'sajauca Confidentiality ar Integrity',
  LEAK_AS_A: 'uzskatīja datu noplūdi par Availability problēmu',
  RANSOM_ONLY_C: 'ransomware klasificēja tikai kā Confidentiality incidentu (palaida garām A)',
  ALL_CIA: 'uzskatīja, ka jebkurš kiberuzbrukums automātiski ietekmē visus C+I+A',
  I_NO_EVIDENCE: 'izdarīja secinājumu par Integrity, lai gan avotos nebija pierādījumu par datu izmaiņām',
  OVERCONFIDENT: 'atzīmēja “Pierādīts”, lai gan avoti to vēl neapstiprināja',
  UNDERCONFIDENT: 'neatzina pierādītu ietekmi (“Nav pierādījumu”, lai gan fakts bija apstiprināts)',
  SOCIAL_AS_FACT: 'sociālo tīklu vai anonīmu apgalvojumu uzskatīja par faktu / izmantoja kā pierādījumu',
  MISSED_OVERLAP: 'nepamanīja, ka incidentā skarti vairāki CIA elementi'
};

const MODULES = [
  { id: 'learn', num: 1, title: 'Iemācies CIA', short: 'CIA pamati', type: 'learn' },
  { id: 'warmup', num: 2, title: 'Iesildīšanās', short: 'Iesildīšanās', type: 'warmup' },
  { id: 'lvm', num: 3, title: 'CASE 01 — Latvijas valsts meži', short: 'CASE 01 · LVM', type: 'case' },
  { id: 'csdd', num: 4, title: 'CASE 02 — CSDD', short: 'CASE 02 · CSDD', type: 'case' },
  { id: 'ddos', num: 5, title: 'CASE 03 — DDoS pret valsts vietnēm', short: 'CASE 03 · DDoS', type: 'case' },
  { id: 'compare', num: 6, title: 'Salīdzini: LVM pret CSDD', short: 'Salīdzinājums', type: 'compare' },
  { id: 'detective', num: 7, title: 'CIA detektīvs', short: 'CIA detektīvs', type: 'detective' },
  { id: 'final', num: 8, title: 'Gala uzdevums: CIA Incident Assessment', short: 'Gala uzdevums', type: 'final' }
];

module.exports = {
  EL, EL_INFO, STATUS, KINDS, KIND_HELP, RATING_LABELS, SOURCE_TYPES, CATEGORIES, GRADE_SCALE,
  CARDS, RULES, FUND_ITEMS, WARM_ITEMS, CASES: { lvm: LVM, csdd: CSDD, ddos: DDOS },
  BINS, DETECTIVE, COMPARE, FINAL, ERROR_TYPES, MODULES
};
