# KIB1 — CIA Incidentu laboratorija

Interaktīva tīmekļa lietotne profesionālās izglītības programmas **“Kiberdrošības tehniķis”** 1. kursa stundai.
Galvenā tēma — **CIA triāde**: Confidentiality (konfidencialitāte), Integrity (integritāte), Availability (pieejamība).

Audzēknis kļūst par *Junior Cyber Incident Analyst* un, izmeklējot reālus Latvijas kiberincidentus, mācās pamatoti pateikt:

> “KONFIDENCIALITĀTE / INTEGRITĀTE / PIEEJAMĪBA **IR / NAV** ietekmēta, **JO** …”
> vai: “Šobrīd mums nav pietiekami daudz pierādījumu, lai par šo CIA elementu izdarītu secinājumu.”

---

## 1. Palaišana (5 minūtes)

**Vajadzīgs:** Node.js 18 vai jaunāks (<https://nodejs.org>, LTS versija). Citas programmas nav jāinstalē — SQLite ir iekļauts (sql.js), nekas nav jākompilē.

### Windows (visvienkāršāk)
1. Atarhivē mapi, piem., `C:\KIB1`.
2. Dubultklikšķis uz **`start.bat`**.
   Pirmajā reizē tas izveido `.env` failu un instalē atkarības (vajag internetu), pēc tam palaiž serveri.
3. Ja Windows jautā par ugunsmūri — atļauj piekļuvi **privātajos tīklos** (citādi audzēkņu datori nevarēs pieslēgties).

### Jebkurā sistēmā
```bash
npm install
npm start
```

Servera logā redzēsi, piemēram:
```
  Šajā datorā:        http://localhost:3000
  Audzēkņiem:         http://192.168.1.25:3000
  Pedagoga panelis:   http://localhost:3000/admin
  Piekļuves kods:     KIB1
```

- **Audzēkņi** pārlūkā atver adresi `http://<pedagoga-datora-IP>:3000` un ievada **Vārds, Uzvārds, Piekļuves kods `KIB1`**.
- **Pedagogs** atver `/admin` (noklusējuma parole `skolotajs` — nomaini to `.env` failā!).

Apturēt serveri: `Ctrl+C` (dati tiek saglabāti).

### Iestatījumi (`.env`)
| Mainīgais | Noklusējums | Nozīme |
|---|---|---|
| `PORT` | `3000` | Servera ports |
| `ACCESS_CODE` | `KIB1` | Kods, ko ievada audzēkņi |
| `ADMIN_PASSWORD` | `skolotajs` | Pedagoga paneļa parole |
| `DB_FILE` | `data/kib1.sqlite` | SQLite datubāzes fails |

---

## 2. Stundas gaita

| # | Modulis | Kas notiek | Aptuveni |
|---|---|---|---|
| 1 | **Iemācies CIA** | 3 lielas CIA kartītes, “CIA var pārklāties”, 6 pārbaudes jautājumi (t.sk. vairāku elementu izvēle) | 8 min |
| 2 | **Iesildīšanās** | 10 vienkāršas situācijas C / I / A ar tūlītēju skaidrojumu | 7 min |
| 3 | **CASE 01 — Latvijas valsts meži** (2026. g. jūnijs) | Ziņu video apskats → laika līnija (5 soļi) → avotu analīze (8 avoti) → CIA Assessment | 20 min |
| 4 | **CASE 02 — CSDD** (2026. g. augusts) | Tāda pati struktūra — liela datu noplūde bez A ietekmes | 18 min |
| 5 | **CASE 03 — DDoS pret valsts vietnēm** (2025. g. 2. okt.) | Īss “tīrs Availability” gadījums | 7 min |
| 6 | **Salīdzinājums LVM pret CSDD** | Audzēknis pats aizpilda C/I/A tabulu + 4 jautājumi (t.sk. “Vai ir pietiekami pierādījumi Integrity pārkāpumam?” → *Nē, nav pietiekamu datu*) | 6 min |
| 7 | **CIA detektīvs** | 18 situācijas jāievelk 7 grozos: C, I, A, C+I, C+A, I+A, C+I+A | 8 min |
| 8 | **Gala uzdevums** | Jauns izdomāts incidents (“Rīvas ūdens”): statuss + vērtējums 0–4 + pamatojums katram elementam, “droši zināms / nav pierādīts”, papildu informācijas pieprasījums | 12 min |
|   | **Rezultāts** | CIA ANALYSIS COMPLETE: punkti, atzīme, C/I/A %, personalizēta atgriezeniskā saite | — |

Kopā ~80–90 min (dubultstunda). Progress saglabājas serverī, tāpēc darbu var turpināt nākamajā stundā.

**Kā notiek izmeklēšana (katrā Case File):**
1. Audzēknis redz tikai sākotnējo ziņu un atbild: *Ko mēs šobrīd varam secināt par CIA?* — katram elementam **Pierādīts / Iespējams / Nav pierādījumu**.
2. Pa laika līniju parādās jauni avoti (uzņēmums, CERT.LV, mediji, eksperti, X, Threads). Pēc katra — *“Vai tava CIA analīze ir mainījusies?”* (iepriekšējais vērtējums jau atzīmēts; sistēma fiksē, ko audzēknis mainīja).
3. **Avotu analīze:** katram apgalvojumam — FAKTS / EKSPERTA INTERPRETĀCIJA / PIEŅĒMUMS / NAV PIETIEKAMI PIERĀDĪJUMU un kuram CIA elementam tas der (vai “neder CIA vērtējumam”).
4. **CIA Assessment:** katram elementam vērtējums 0–4, obligāti atzīmēti fakti, kas to pamato, un rakstisks pamatojums. Pēc iesniegšanas — analītiķa skaidrojums un parauga formulējums.

Moduļi atveras secīgi. Pedagogs var tos atbloķēt visus uzreiz (*Iestatījumi → Atbloķēt visus moduļus*).
Atbildi uz jautājumu var iesniegt vienu reizi (lai skaidrojums nekļūtu par “pareizo atbilžu lapu”); pedagogs var konkrētu atbildi dzēst, un audzēknis to var atbildēt vēlreiz.

---

## 3. Vērtēšana (100 punkti)

| Daļa | Punkti |
|---|---|
| CIA pamatu izpratne | 15 |
| Vienkāršo situāciju klasifikācija | 15 |
| Reālo incidentu CIA analīze (laika līnijas vērtējumi, CIA Assessment vērtējumi, salīdzinājums) | 30 |
| Avotu izmantošana CIA pamatojumam (avotu klasifikācija + faktu izvēle CIA Assessment) | 15 |
| CIA detektīvs | 10 |
| Noslēguma incidenta analīze | 15 |

- Punkti tiek piešķirti par **CIA spriedumiem**, nevis faktu (datumu, skaitļu) iegaumēšanu.
- Pieņemamām alternatīvām ir pilni punkti, robežgadījumiem — puse (piem., “Iespējams” vietā “Nav pierādījumu”).
- Ja fakti nav pierādīti, **“Nav pierādījumu” / vērtējums 0 ir pareiza atbilde** — sistēma nekad nepiespiež “izdomāt” Integrity pārkāpumu.
- Gala uzdevuma pamatojuma tekstu punkti tiek aprēķināti automātiski un **provizoriski** (garums + pamatojuma vārdi “jo”, “pierādīts”, “apstiprina” u.c.). Pedagogs var jebkuras atbildes punktus koriģēt audzēkņa lapā.
- Atzīme pēc 10 ballu skalas: 95%→10, 87%→9, 79%→8, 69%→7, 59%→6, 47%→5, 34%→4, 21%→3, 11%→2 (maināms `content/lesson.js`, `GRADE_SCALE`).
- **C %, I %, A %** — cik precīzi audzēknis vērtēja katru elementu visos uzdevumos.

---

## 4. Pedagoga panelis (`/admin`)

- **Audzēkņi:** Audzēknis · Progress · Punkti · % · Atzīme · C % · I % · A % · Statuss (strādā / neaktīvs / pabeidza / nav pieslēdzies). Tabula atjaunojas ik 10 s, kolonnas var kārtot.
- Klikšķis uz audzēkņa: visas atbildes, sagaidāmās atbildes, CIA klasifikācijas, izvēlētie fakti, rakstītie pamatojumi, kļūdas, vai mainīja vērtējumu laika līnijā, punkti. Punktu korekcija ar piezīmi, atbildes dzēšana, progresa atiestatīšana.
- **Klases kopsavilkums:** vidējais rezultāts un atzīme, vidējais C / I / A (un kuru elementu klase saprot vājāk), 5 sarežģītākie jautājumi, vidēji pa daļām, **TIPISKĀKĀS CIA KĻŪDAS** un biežākā kļūda.
- **Iestatījumi:** klases saraksts (ielīmē 18 vārdus — redzēsi arī tos, kas vēl nav pieslēgušies), moduļu atbloķēšana.
- **⬇ CSV** — rezultātu eksports (atveras Excel).

Automātiski atpazītās tipiskās kļūdas: sajauca I ar A; sajauca C ar I; datu noplūdi uzskatīja par A problēmu; ransomware tikai kā C; “jebkurš uzbrukums = C+I+A”; Integrity secinājums bez pierādījumiem; “Pierādīts”, kad avoti vēl neapstiprina; neatzina pierādītu ietekmi; sociālo tīklu apgalvojumu uzskatīja par faktu; nepamanīja vairāku elementu pārklāšanos.
Procents = cik bieži klase pieļāva kļūdu atbildēs, kur tā bija iespējama (papildus redzams, cik audzēkņu to pieļāva vismaz reizi).

---

## 5. Pieslēgšanās un datu saglabāšana

- Rezultāti tiek glabāti **SQLite datubāzē** `data/kib1.sqlite` uzreiz pēc katras atbildes (atomāra ierakstīšana).
- Arī nepabeigtie teksti (CIA Assessment pamatojumi, gala uzdevums, detektīva izkārtojums) tiek saglabāti serverī kā melnraksti.
- Ja audzēknis pārlādē lapu — viss paliek. Ja aizver pārlūku vai pārsēžas pie cita datora — pieslēdzas ar **to pašu vārdu un uzvārdu** (lielie burti un garumzīmes netiek ņemti vērā) un turpina.
- **Rezerves kopija:** nokopē failu `data/kib1.sqlite`. **Jauna klase / tīrs sākums:** aptur serveri un izdzēs šo failu (vai atiestati audzēkņus panelī).
- Pārbaudīts ar 30 vienlaicīgiem audzēkņiem (1800 atbildes ~4 sekundēs, bez kļūdām).

---

## 6. Saturs un avoti

Viss saturs ir vienā failā **`content/lesson.js`** (teksti, pareizās atbildes, skaidrojumi, punkti) — to var labot bez programmēšanas zināšanām, saglabājot struktūru, un pārstartēt serveri.

Fakti par reālajiem incidentiem apkopoti **2026. gada septembrī** no publiskiem avotiem. Pie katra avota lietotnē ir saite “Atvērt avotu ↗”. **Pirms stundas ieteicams saites atvērt un pārliecināties**, vai informācija nav precizēta.

**CASE 01 — AS “Latvijas valsts meži”**
- LVM paziņojums: <https://www.lvm.lv/jaunumi/8018-lvm-saskaries-ar-kiberdrosibas-incidentu>
- CERT.LV: <https://cert.lv/lv/2026/06/as-latvijas-valsts-mezi-kiberdrosibas-incidents-aktuala-informacija>
- LSM 25.06., 26.06., 28.06., 02.07., 25.07., 17.08.2026 (saites lietotnē)
- Diena/LETA par 44 GB noplūdi; TVNET (eksperts par noplūdes saturu; LVM precizējumi; Faktomāts par “vēlēšanu” apgalvojumiem)

**CASE 02 — CSDD**
- CSDD paziņojums: <https://www.csdd.lv/jaunumi/csdd-saskaries-ar-kiberdrosibas-incidentu>
- CERT.LV: <https://cert.lv/lv/2026/08/csdd-saskaries-ar-kiberdrosibas-incidentu>
- LSM 13.08., 14.08. (arī video YouTube), 18.08., 19.08., 20.08., 18.09.2026; Jauns.lv (E. Strazdiņa komentāri)

**CASE 03 — DDoS pret valsts vietnēm (02.10.2025)**
- LVRTC: <https://www.lvrtc.lv/jaunumi/jaunumi/ddos-valsts-resursiem-2-10/>
- Sargs.lv, Apollo/LETA

**Svarīgi par sociālo tīklu ierakstiem:** X, Threads, Telegram un anonīmo komentāru ieraksti lietotnē ir atzīmēti kā **“ilustratīvs ieraksts”**. Tie **nav citāti no konkrētiem kontiem** — tie ir mācību nolūkam veidoti tipiski apgalvojumi, kas atspoguļo publiskajā telpā izplatītus vēstījumus (piem., TVNET Faktomāts atspēkoja apgalvojumus, ka LVM uzbrukums bija vēlēšanu falsificēšanai). Ekspertu (t.sk. Elvisa Strazdiņa) teiktais ir sniegts kā **parafrāze** ar atsauci uz publikāciju.

“Video apskats” ir lietotnē iebūvēts animēts ziņu apskats (darbojas arī bez interneta); oriģinālie video (LSM YouTube, TVNET, Apollo) ir pieejami saitēs zem tā. Gala uzdevuma incidents (“Rīvas ūdens”) ir **izdomāts**.

---

## 7. Problēmu risināšana

| Problēma | Risinājums |
|---|---|
| Audzēkņi nevar atvērt adresi | Visiem jābūt vienā tīklā; pārbaudi IP servera logā; Windows ugunsmūrī atļauj Node.js privātajos tīklos. |
| `npm install` neizdodas | Vajag interneta savienojumu pirmajā palaišanā. Pēc tam lietotne darbojas bez interneta (izņemot ārējās saites un YouTube video). |
| Ports aizņemts | Maini `PORT` failā `.env`. |
| Audzēknis ievadīja vārdu ar kļūdu | Panelī dzēs lieko ierakstu; lai turpina ar pareizo vārdu. |
| Aizmirsta pedagoga parole | Skaties/maini `ADMIN_PASSWORD` failā `.env` un pārstartē serveri. |

---

## 8. Tehniskā uzbūve

```
server.js              Express serveris, API, pedagoga API, CSV eksports
lib/db.js              SQLite (sql.js) + atomāra saglabāšana failā
lib/grading.js         Vērtēšana: punkti, C/I/A %, tipisko kļūdu noteikšana
lib/publicContent.js   Saturs pārlūkam BEZ pareizajām atbildēm
content/lesson.js      Viss mācību saturs un atbilžu atslēgas
public/                Audzēkņa lietotne (index.html, app.js) un pedagoga panelis (admin.html, admin.js)
data/kib1.sqlite       Datubāze (tiek izveidota automātiski)
start.bat · .env.example
```

Pareizās atbildes un skaidrojumi pārlūkam tiek nosūtīti tikai **pēc** atbildes iesniegšanas; vērtēšana notiek serverī.
