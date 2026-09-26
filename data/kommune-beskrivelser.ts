// Første udkast til "Om [kommune]" på rapportsiden, skrevet med AI og beregnet til at
// blive gennemgået. Indlæses med `pnpm db:seed:kommune-tekster`, som kun udfylder tomme
// felter, så rettelser fra admin-panelet ikke overskrives.
//
// stoersteBy er tom (null) for kommuner i hovedstadsområdets sammenhængende byområde,
// hvor der ikke er én selvstændig by at nævne, og hvor flere byer er næsten lige store
// (skal tjekkes mod Danmarks Statistik). Feltet skjules så på rapportsiden.
// Tal (indbyggere, areal) er bevidst udeladt – de vises beregnet i faktaboksen.

export type KommuneTekst = { stoersteBy: string | null; beskrivelse: string };

export const KOMMUNE_BESKRIVELSER: Record<string, KommuneTekst> = {
  // --- Region Hovedstaden ---
  "0101": {
    stoersteBy: "København",
    beskrivelse:
      "Københavns Kommune er Danmarks hovedstad og landets største kommune målt på indbyggere. Kommunen rummer Folketinget, regeringen, en lang række uddannelsesinstitutioner og mange af landets største arbejdspladser. Byen er kendt for sine cykelstier, havnebade og bydele med vidt forskellig karakter – fra middelalderbyen og Nyhavn til Ørestad og Nordhavn. Metro, S-tog og regionaltog forbinder kommunen med resten af hovedstadsområdet, og Københavns Lufthavn ligger i nabokommunen Tårnby.",
  },
  "0147": {
    stoersteBy: "Frederiksberg",
    beskrivelse:
      "Frederiksberg er en selvstændig kommune midt i København og en af landets tættest befolkede. Kommunen er kendt for Frederiksberg Have, Søndermarken og Zoologisk Have samt boulevarder og villakvarterer. Her ligger bl.a. Copenhagen Business School, og metroen giver hurtig forbindelse til resten af byen. Kommunen har et bymæssigt præg med mange butikker, caféer og korte afstande.",
  },
  "0151": {
    stoersteBy: null,
    beskrivelse:
      "Ballerup Kommune ligger i den vestlige del af hovedstadsområdet og omfatter bl.a. Ballerup, Skovlunde og Måløv. Kommunen er en klassisk erhvervsforstad med mange virksomheder inden for teknologi og produktion. S-toget forbinder Ballerup med det centrale København, og der er grønne områder og kulturhistorie, bl.a. Pederstrup med Ballerup Museum. Kommunen blander parcelhuskvarterer, etageboliger og landsbyer i den vestlige ende.",
  },
  "0153": {
    stoersteBy: null,
    beskrivelse:
      "Brøndby Kommune ligger sydvest for København og består af Brøndbyøster, Brøndbyvester og Brøndby Strand. Kommunen er kendt for fodboldklubben Brøndby IF og stadionet af samme navn. Langs Køge Bugt ligger strand- og naturområder, og kommunen har gode forbindelser via S-tog og motorvej. Boligmassen spænder fra parcelhuse til større almene boligområder.",
  },
  "0155": {
    stoersteBy: "Dragør",
    beskrivelse:
      "Dragør Kommune ligger på den sydlige del af Amager og omfatter Dragør og Store Magleby. Den gamle fiskerby Dragør er kendt for sine gule huse, brostensgader og hyggelige havn. Kommunen grænser op til Kalvebod Fælled og Øresund, og Københavns Lufthavn ligger lige nord for. Dragør har et roligt, landsbyagtigt præg tæt på hovedstaden.",
  },
  "0157": {
    stoersteBy: null,
    beskrivelse:
      "Gentofte Kommune ligger nord for København langs Øresundskysten og omfatter bl.a. Hellerup, Charlottenlund, Ordrup og Gentofte. Kommunen er præget af villakvarterer, strandparker og skove som Charlottenlund Slotshave og Dyrehaven i nærheden. Her ligger bl.a. Bernstorff Slot og Øregaard Museum. Kystbanen og S-toget giver gode forbindelser til København.",
  },
  "0159": {
    stoersteBy: null,
    beskrivelse:
      "Gladsaxe Kommune ligger nordvest for København og omfatter bl.a. Søborg, Bagsværd, Buddinge og Mørkhøj. Kommunen har en stærk erhvervsprofil med flere store virksomheder, bl.a. inden for medicinalindustrien. Bagsværd Sø og Gladsaxe Sportscenter er populære fritidsområder. Hovedstadens letbane langs Ring 3 går gennem kommunen.",
  },
  "0161": {
    stoersteBy: null,
    beskrivelse:
      "Glostrup Kommune ligger vest for København og er en af landets mindste kommuner i areal. Kommunen er et vigtigt trafikknudepunkt med S-tog, motorveje og den nye letbane langs Ring 3. Her ligger Rigshospitalet Glostrup og et stort antal arbejdspladser i forhold til kommunens størrelse. Glostrup Park og Vestskoven i nærheden giver grønne åndehuller.",
  },
  "0163": {
    stoersteBy: null,
    beskrivelse:
      "Herlev Kommune ligger nordvest for København og er kendt for Herlev Hospital, et af landets største sygehuse. Kommunen har en blanding af parcelhuse, etageboliger og erhvervsområder. S-toget og letbanen langs Ring 3 forbinder Herlev med resten af hovedstadsområdet. Grønne områder som Kagsmosen og Hjortespringkilen ligger inden for kommunen.",
  },
  "0165": {
    stoersteBy: null,
    beskrivelse:
      "Albertslund Kommune ligger vest for København og blev i høj grad udbygget i 1960'erne og 70'erne med tæt-lav bebyggelse og adskilte stier for gående og cyklister. Kommunen er kendt for sine grønne kvaliteter med Vestskoven og Egelundsparken. Albertslund Station ligger på S-togslinjen, og kommunen arbejder aktivt med klima og energirenovering. Der er både boligområder og større erhvervskvarterer.",
  },
  "0167": {
    stoersteBy: null,
    beskrivelse:
      "Hvidovre Kommune ligger sydvest for København ud til Kalveboderne. Kommunen omfatter bl.a. Hvidovre, Avedøre og Friheden og har både parcelhuskvarterer og større boligområder. Hvidovre Hospital er en stor arbejdsplads, og Avedøre Holme er et vigtigt erhvervsområde. Kysten, Avedøre Havn og Kalvebod Fælled på den anden side af vandet giver adgang til natur og friluftsliv.",
  },
  "0169": {
    stoersteBy: null,
    beskrivelse:
      "Høje-Taastrup Kommune ligger vest for København og omfatter bl.a. Taastrup, Hedehusene og en række landsbyer. Kommunen er et trafikknudepunkt med S-tog, regionaltog og motorveje, og Høje Taastrup Station er et vigtigt skiftested. Her ligger store erhvervs- og logistikområder samt City 2. Den vestlige del af kommunen har et mere landligt præg.",
  },
  "0173": {
    stoersteBy: null,
    beskrivelse:
      "Lyngby-Taarbæk Kommune ligger nord for København og omfatter bl.a. Kongens Lyngby, Taarbæk og Virum. Kommunen er kendt for Danmarks Tekniske Universitet (DTU), Dyrehaven med Eremitageslottet og Bakken samt Frilandsmuseet. Lyngby Hovedgade og Lyngby Storcenter gør bymidten til et regionalt handelscentrum. Søer, skove og kyst gør naturen let tilgængelig.",
  },
  "0175": {
    stoersteBy: null,
    beskrivelse:
      "Rødovre Kommune ligger vest for København og er en tæt forstadskommune med parcelhuse og etageboliger. Kommunen er kendt for Rødovre Centrum og Arne Jacobsens rådhus fra 1950'erne. Motorring 3 og S-toget giver gode forbindelser, og Vestvolden løber gennem kommunen som et grønt, historisk forsvarsanlæg. Der er korte afstande til både centrum af København og Vestskoven.",
  },
  "0183": {
    stoersteBy: null,
    beskrivelse:
      "Ishøj Kommune ligger ved Køge Bugt sydvest for København. Kommunen er kendt for Arken – Museum for Moderne Kunst, der ligger ved Ishøj Strand, og for Køge Bugt Strandpark. Ishøj har både ældre landsbymiljøer og større boligområder fra 1970'erne. S-toget forbinder kommunen med København og Køge.",
  },
  "0185": {
    stoersteBy: null,
    beskrivelse:
      "Tårnby Kommune dækker den midterste og nordlige del af Amager og omfatter bl.a. Kastrup og Tårnby. Københavns Lufthavn ligger i kommunen og er en af regionens største arbejdspladser. Den Blå Planet – Danmarks Akvarium ligger ved Kastrup, og Øresundsbroens landanlæg udgår herfra. Metro og tog giver hurtig forbindelse til centrum af København.",
  },
  "0187": {
    stoersteBy: null,
    beskrivelse:
      "Vallensbæk Kommune ligger ved Køge Bugt sydvest for København og er en af landets mindste kommuner. Kommunen omfatter Vallensbæk og Vallensbæk Strand og er overvejende et boligområde med parcelhuse og rækkehuse. Vallensbæk Mose og Køge Bugt Strandpark giver gode muligheder for friluftsliv. S-tog og motorvej forbinder kommunen med resten af hovedstadsområdet.",
  },
  "0190": {
    stoersteBy: "Farum",
    beskrivelse:
      "Furesø Kommune ligger nordvest for København og omfatter byerne Farum og Værløse samt en række mindre bysamfund. Kommunen er opkaldt efter Furesøen, Danmarks dybeste sø, og har mange søer, skove og moser. Farum og Værløse har hver deres S-togsstation og bymidte. Kommunen kombinerer forstadsliv med let adgang til naturen.",
  },
  "0201": {
    stoersteBy: "Lillerød",
    beskrivelse:
      "Allerød Kommune ligger i Nordsjælland og omfatter byerne Lillerød og Blovstrød samt landsbyer og landområder. Kommunen er præget af skov, søer og åbent land, bl.a. Store Dyrehave og Ravnsholt Skov. S-toget til Hillerød giver forbindelse til København. Allerød har primært boligkarakter med villakvarterer og mindre erhvervsområder.",
  },
  "0210": {
    stoersteBy: null,
    beskrivelse:
      "Fredensborg Kommune ligger i Nordsjælland og omfatter bl.a. Fredensborg, Humlebæk, Kokkedal, Nivå og Karlebo. Kommunen er kendt for Fredensborg Slot, dronningens sommerresidens, og for Louisiana Museum of Modern Art i Humlebæk. Esrum Sø og kyststrækningen langs Øresund giver gode naturoplevelser. Kystbanen forbinder de østlige byer med København og Helsingør.",
  },
  "0217": {
    stoersteBy: "Helsingør",
    beskrivelse:
      "Helsingør Kommune ligger i den nordøstlige spids af Sjælland ved Øresunds smalleste sted. Kommunen er kendt for Kronborg Slot, som er på UNESCOs verdensarvsliste, M/S Museet for Søfart og Kulturværftet. Færgerne til Helsingborg i Sverige afgår herfra. Ud over Helsingør by omfatter kommunen bl.a. Espergærde, Snekkersten, Hornbæk og Tikøb.",
  },
  "0219": {
    stoersteBy: "Hillerød",
    beskrivelse:
      "Hillerød Kommune ligger midt i Nordsjælland, og Hillerød er et regionalt center for handel, uddannelse og offentlig administration. Byen er kendt for Frederiksborg Slot med Det Nationalhistoriske Museum. Kommunen har store skovområder som Gribskov og Store Dyrehave, der indgår i Parforcejagtlandskabet på UNESCOs verdensarvsliste. Hillerød er endestation for S-toget og knudepunkt for Lokaltogets baner.",
  },
  "0223": {
    stoersteBy: "Hørsholm",
    beskrivelse:
      "Hørsholm Kommune ligger i Nordsjælland mellem Øresund og Rungsted og omfatter bl.a. Hørsholm, Rungsted og Vallerød. Kommunen er kendt for Rungstedlund med Karen Blixen Museet, Rungsted Havn og Hørsholm Slotspark. Hørsholm er en af landets mindre kommuner i areal og har et grønt, villapræget miljø. Kystbanen og motorvejen giver gode forbindelser mod København.",
  },
  "0230": {
    stoersteBy: "Birkerød",
    beskrivelse:
      "Rudersdal Kommune ligger nord for København og omfatter bl.a. Holte, Birkerød, Nærum, Vedbæk og Trørød. Kommunen er præget af søer, skove og kyst, bl.a. Furesøen, Rude Skov og Øresundskysten ved Vedbæk. Den har mange villakvarterer og et aktivt forenings- og kulturliv. S-tog, Kystbanen og Nærumbanen forbinder kommunen med København.",
  },
  "0240": {
    stoersteBy: "Ølstykke-Stenløse",
    beskrivelse:
      "Egedal Kommune ligger nordvest for København og omfatter bl.a. Ølstykke, Stenløse, Smørumnedre og Ganløse. Kommunen har et grønt præg med skove, moser og åbent land mellem byerne. S-toget mod Frederikssund betjener Stenløse og Ølstykke. Egedal er primært en boligkommune med mange børnefamilier.",
  },
  "0250": {
    stoersteBy: "Frederikssund",
    beskrivelse:
      "Frederikssund Kommune ligger i Nordsjælland ved Roskilde Fjord og Isefjord og omfatter bl.a. Frederikssund, Jægerspris, Slangerup og Skibby. Kommunen er kendt for Vikingespillene i Frederikssund og Jægerspris Slot. Hornsherred-halvøen byder på fjordlandskab, skove og landsbyer. S-toget har endestation i Frederikssund, og Kronprinsesse Marys Bro forbinder byen med Hornsherred.",
  },
  "0260": {
    stoersteBy: "Frederiksværk",
    beskrivelse:
      "Halsnæs Kommune ligger på Nordsjællands vestkyst og omfatter bl.a. Frederiksværk, Hundested, Ølsted og Liseleje. Frederiksværk har en lang industrihistorie med jern- og stålproduktion. Hundested er udgangspunkt for færgen til Rørvig, og kysten har populære sommerhusområder og strande. Kommunen grænser op til Arresø, Danmarks største sø.",
  },
  "0270": {
    stoersteBy: "Helsinge",
    beskrivelse:
      "Gribskov Kommune ligger i Nordsjælland og omfatter bl.a. Helsinge, Gilleleje, Græsted og Vejby. Kommunen har en lang Kattegatkyst med kendte strande og sommerhusområder, og Gilleleje er en livlig fiskeri- og turistby. Store skove som Gribskov og søer som Esrum Sø ligger i kommunen. Lokaltog forbinder byerne med Hillerød.",
  },
  "0400": {
    stoersteBy: "Rønne",
    beskrivelse:
      "Bornholms Regionskommune omfatter øen Bornholm i Østersøen samt ertholmene omkring Christiansø. Øen er kendt for klippekyster, Hammershus, rundkirker, kunsthåndværk og en stærk madkultur. Rønne er øens største by og havn med færgeforbindelse til Ystad og Køge. Turisme, fødevarer og kunsthåndværk er vigtige erhverv, og øen har egen lufthavn.",
  },

  // --- Region Sjælland ---
  "0253": {
    stoersteBy: null,
    beskrivelse:
      "Greve Kommune ligger ved Køge Bugt syd for København og omfatter bl.a. Greve Strand, Karlslunde og Tune. Kommunen har en lang sandstrand med strandpark og mange parcelhuskvarterer. S-toget langs kysten giver hurtig forbindelse til København og Køge. Den vestlige del af kommunen er præget af landsbyer og landbrug.",
  },
  "0259": {
    stoersteBy: "Køge",
    beskrivelse:
      "Køge Kommune ligger ved Køge Bugt og er en af Sjællands ældste købstæder med en velbevaret middelalderbymidte. Kommunen har en aktiv havn og et stort nyt hospital, Sjællands Universitetshospital. Køge Station er et trafikknudepunkt med S-tog, regionaltog og højhastighedsbanen mod Ringsted. Ud over Køge omfatter kommunen bl.a. Borup, Herfølge og landsbyer i oplandet.",
  },
  "0265": {
    stoersteBy: "Roskilde",
    beskrivelse:
      "Roskilde Kommune ligger ved Roskilde Fjord vest for København. Roskilde er en af Danmarks ældste byer og kendt for Roskilde Domkirke, som er på UNESCOs verdensarvsliste, Vikingeskibsmuseet og Roskilde Festival. Byen har Roskilde Universitet og er et vigtigt trafikknudepunkt. Kommunen omfatter også bl.a. Jyllinge, Viby Sjælland og Gundsømagle.",
  },
  "0269": {
    stoersteBy: "Solrød Strand",
    beskrivelse:
      "Solrød Kommune ligger ved Køge Bugt mellem Greve og Køge og omfatter bl.a. Solrød Strand, Havdrup og Jersie. Kommunen har en lang kyststrækning med strand og strandeng. S-toget langs Køge Bugt gør det let at pendle til København. Solrød er primært en boligkommune med parcelhuse og et aktivt foreningsliv.",
  },
  "0306": {
    stoersteBy: "Nykøbing Sjælland",
    beskrivelse:
      "Odsherred Kommune ligger i Nordvestsjælland og omfatter bl.a. Nykøbing Sjælland, Asnæs, Vig og Rørvig. Området er kendt for Geopark Odsherred, der er udpeget af UNESCO, og for Danmarks største samling af sommerhuse. Kystlinjen mod Kattegat og Sejerøbugten har mange populære strande. Lokaltoget forbinder kommunen med Holbæk.",
  },
  "0316": {
    stoersteBy: "Holbæk",
    beskrivelse:
      "Holbæk Kommune ligger i Vestsjælland ved Holbæk Fjord og Isefjord og omfatter bl.a. Holbæk, Tølløse, Jyderup og Svinninge. Holbæk er en gammel købstad med havn og et regionalt handelscentrum. Kommunen har et varieret landskab med fjord, skove og landbrugsland. Tog og motorvej giver direkte forbindelse til København.",
  },
  "0320": {
    stoersteBy: "Haslev",
    beskrivelse:
      "Faxe Kommune ligger på Østsjælland og omfatter bl.a. Haslev, Faxe, Faxe Ladeplads og Rønnede. Kommunen er kendt for Faxe Kalkbrud med fossiler fra en oldtidskoralrev og for Faxe Bryggeri. Kysten ved Faxe Bugt har strande og sommerhusområder. Haslev ligger på jernbanen mellem Køge og Næstved.",
  },
  "0326": {
    stoersteBy: "Kalundborg",
    beskrivelse:
      "Kalundborg Kommune ligger i Vestsjælland og har en lang kyst mod Kattegat og Storebælt. Kalundborg er kendt for sin tunge industri og Kalundborg Symbiosen, hvor virksomheder deler energi og ressourcer. Byen har en markant middelalderkirke med fem tårne og en vigtig havn med færge til Samsø. Kommunen omfatter også bl.a. Gørlev, Høng og Svebølle samt halvøen Røsnæs.",
  },
  "0329": {
    stoersteBy: "Ringsted",
    beskrivelse:
      "Ringsted Kommune ligger midt på Sjælland og er et vigtigt knudepunkt for jernbane og motorvej. Ringsted er en gammel købstad med Sankt Bendts Kirke, hvor flere middelalderkonger er begravet. Kommunen har voksende erhvervs- og logistikområder og et stort outletcenter. Landskabet omkring byen er præget af skove, søer og landbrugsland.",
  },
  "0330": {
    stoersteBy: "Slagelse",
    beskrivelse:
      "Slagelse Kommune ligger i Vestsjælland og omfatter bl.a. Slagelse, Korsør, Skælskør og Dalmose. Slagelse er et regionalt center for handel og uddannelse, og Korsør ligger ved Storebæltsbroen. Kommunen har kyst mod både Storebælt og Smålandsfarvandet samt Trelleborg, en af Danmarks vikingeborge. Tog og motorvej forbinder kommunen med både København og Fyn.",
  },
  "0336": {
    stoersteBy: "Store Heddinge",
    beskrivelse:
      "Stevns Kommune ligger på Østsjælland og omfatter bl.a. Store Heddinge, Hårlev og Strøby Egede. Kommunen er kendt for Stevns Klint, der er på UNESCOs verdensarvsliste, samt Højerup Gamle Kirke på klinten. Koldkrigsmuseum Stevnsfort ligger også her. Landskabet er præget af landbrug, landsbyer og kyst.",
  },
  "0340": {
    stoersteBy: "Sorø",
    beskrivelse:
      "Sorø Kommune ligger midt i Vestsjælland og omfatter bl.a. Sorø, Dianalund og Ruds Vedby. Sorø er kendt for Sorø Akademi, Klosterkirken og beliggenheden ved Sorø Sø omgivet af skov. Kommunen har et grønt og roligt præg med søer og store skove. Tog og motorvej forbinder Sorø med både København og Fyn.",
  },
  "0350": {
    stoersteBy: null,
    beskrivelse:
      "Lejre Kommune ligger mellem Roskilde Fjord og Isefjord og består af mange mindre byer og landsbyer, bl.a. Kirke Hyllinge, Hvalsø, Lejre og Kirke Såby. Kommunen er kendt for Sagnlandet Lejre og for Ledreborg Slot. Landskabet er bakket og varieret med skove, fjord og landbrug. Tog fra Hvalsø og Lejre giver forbindelse mod Roskilde og København.",
  },
  "0360": {
    stoersteBy: "Nakskov",
    beskrivelse:
      "Lolland Kommune omfatter størstedelen af øen Lolland samt en række småøer og er præget af landbrug og flade landskaber. Nakskov er kommunens største by, mens Maribo er en gammel købstad og domkirkeby. Kommunen er kendt for Knuthenborg Safaripark og for byggeriet af Femern Bælt-tunnelen ved Rødby. Vindenergi og fødevareproduktion er vigtige erhverv.",
  },
  "0370": {
    stoersteBy: "Næstved",
    beskrivelse:
      "Næstved Kommune ligger på Sydsjælland, og Næstved er et regionalt center for handel, uddannelse og sundhed. Kommunen omfatter også bl.a. Fensmark, Holme-Olstrup og Karrebæksminde ved kysten. Susåen, skove og kyst giver varierede naturoplevelser.",
  },
  "0376": {
    stoersteBy: "Nykøbing Falster",
    beskrivelse:
      "Guldborgsund Kommune omfatter øen Falster og den østlige del af Lolland og er opkaldt efter sundet mellem de to øer. Nykøbing Falster er kommunens største by med sygehus, uddannelser og Middelaldercentret. Marielyst på Østfalster er et af landets store sommerhus- og strandområder. Kommunen omfatter også bl.a. Sakskøbing, Nysted og Stubbekøbing.",
  },
  "0390": {
    stoersteBy: "Vordingborg",
    beskrivelse:
      "Vordingborg Kommune omfatter den sydlige del af Sjælland samt øerne Møn, Bogø og Nyord. Kommunen er kendt for Møns Klint, der er udpeget som UNESCO-biosfæreområde, og for Gåsetårnet i Vordingborg. Stege er den største by på Møn. Kommunen har lang kyst, skove og landsbyer og er et populært turistområde.",
  },

  // --- Region Syddanmark ---
  "0410": {
    stoersteBy: "Middelfart",
    beskrivelse:
      "Middelfart Kommune ligger på det vestlige Fyn ved Lillebælt og omfatter bl.a. Middelfart, Ejby og Nørre Aaby. Kommunen er kendt for de to Lillebæltsbroer, som forbinder Fyn med Jylland, og for marsvinene i Lillebælt. Kystlandskabet byder på stier som Lillebæltsstien. Middelfart har en attraktiv beliggenhed for pendling mod både Odense og Trekantområdet.",
  },
  "0420": {
    stoersteBy: "Assens",
    beskrivelse:
      "Assens Kommune ligger på det vestlige Fyn ud mod Lillebælt og omfatter bl.a. Assens, Glamsbjerg, Haarby, Aarup og Vissenbjerg. Kommunen er præget af landbrug, landsbyer og en lang kyststrækning. Assens er en gammel købstad med havn og marina, og øen Baagø hører til kommunen. Vissenbjerg og Aarup ligger tæt på Odense.",
  },
  "0430": {
    stoersteBy: "Faaborg",
    beskrivelse:
      "Faaborg-Midtfyn Kommune strækker sig fra det sydfynske øhav til Midtfyn og omfatter bl.a. Faaborg, Ringe, Årslev og Broby. Faaborg er en gammel købstad med velbevarede gader og Faaborg Museum. Det Sydfynske Øhav og øer som Lyø, Avernakø og Bjørnø giver mange naturoplevelser. Egeskov Slot ligger i kommunen.",
  },
  "0440": {
    stoersteBy: "Kerteminde",
    beskrivelse:
      "Kerteminde Kommune ligger på det nordøstlige Fyn og omfatter bl.a. Kerteminde, Munkebo og Langeskov. Kerteminde er en gammel fiskerby med havn og Fjord&Bælt, et oplevelsescenter om havet. Halvøen Hindsholm og Kerteminde Fjord præger landskabet. Kommunen ligger tæt på Odense og har gode pendlermuligheder.",
  },
  "0450": {
    stoersteBy: "Nyborg",
    beskrivelse:
      "Nyborg Kommune ligger på det østlige Fyn ved Storebælt og omfatter bl.a. Nyborg, Ørbæk og Ullerslev. Nyborg er kendt for Nyborg Slot, et af Danmarks ældste kongelige slotte, og for sin beliggenhed ved Storebæltsbroen. Byen er et knudepunkt for tog og motorvej mellem Sjælland og Fyn. Kommunen har kyst, skove og landbrugsland.",
  },
  "0461": {
    stoersteBy: "Odense",
    beskrivelse:
      "Odense Kommune er Danmarks tredjestørste kommune og Fyns centrum for uddannelse, sundhed og erhverv. Odense er H.C. Andersens fødeby og har Syddansk Universitet og Odense Universitetshospital. Byen har en stærk position inden for robotteknologi, og letbanen forbinder bymidten med universitetsområdet. Kommunen omfatter også omkringliggende landsbyer og grønne områder langs Odense Å.",
  },
  "0479": {
    stoersteBy: "Svendborg",
    beskrivelse:
      "Svendborg Kommune ligger på Sydfyn ved Svendborgsund og omfatter bl.a. Svendborg samt øerne Tåsinge, Thurø og en række småøer. Svendborg er en gammel søfartsby med maritimt miljø, havn og uddannelser. Valdemars Slot på Tåsinge og Det Sydfynske Øhav tiltrækker mange besøgende. Svendborgbanen forbinder byen med Odense.",
  },
  "0480": {
    stoersteBy: "Otterup",
    beskrivelse:
      "Nordfyns Kommune ligger på det nordlige Fyn og omfatter bl.a. Otterup, Bogense, Søndersø og Morud. Bogense er en gammel købstad med havn og marina ud mod Kattegat. Kommunen er præget af landbrug, kyst og landsbyer, og ligger tæt på Odense. Enebærodde og kysten ved Bogense er populære naturområder.",
  },
  "0482": {
    stoersteBy: "Rudkøbing",
    beskrivelse:
      "Langeland Kommune omfatter øen Langeland og en række mindre øer syd for Fyn. Rudkøbing er øens største by med havn og en velbevaret gammel bydel. Øen er kendt for sin natur med vilde heste på Sydlangeland samt Koldkrigsmuseum Langelandsfort. Langeland er forbundet med Fyn via Tåsinge og har færge til Lolland.",
  },
  "0492": {
    stoersteBy: "Marstal",
    beskrivelse:
      "Ærø Kommune omfatter øen Ærø i Det Sydfynske Øhav. Øen er kendt for Ærøskøbing med brostensgader og bindingsværkshuse samt Marstal med en stolt søfartstradition. Ærø satser på vedvarende energi og har bl.a. eldrevne færger. Øen er forbundet med Svendborg, Fynshav og Faaborg med færge.",
  },
  "0510": {
    stoersteBy: "Haderslev",
    beskrivelse:
      "Haderslev Kommune ligger i Sønderjylland og omfatter bl.a. Haderslev, Vojens og Gram. Haderslev er en gammel købstad med domkirke og en fjord, der strækker sig ind til byen. Kommunen har en garnison og er kendt for Gram Lergrav med fossiler. Landskabet spænder fra østjysk fjordland til flad vestlig slette.",
  },
  "0530": {
    stoersteBy: "Billund",
    beskrivelse:
      "Billund Kommune ligger i Sydjylland og omfatter bl.a. Billund, Grindsted og Vorbasse. Billund er kendt som LEGOs hjemby og har LEGOLAND, LEGO House og Lalandia. Billund Lufthavn er landets næststørste lufthavn. Kommunen har store naturområder med hede og plantager.",
  },
  "0540": {
    stoersteBy: "Sønderborg",
    beskrivelse:
      "Sønderborg Kommune ligger i Sønderjylland og omfatter Als og Sundeved. Sønderborg er en universitets- og industriby med Sønderborg Slot og nærhed til Dybbøl Mølle og Dybbøl Skanser. Kommunen er kendt for sin klimaindsats og for virksomheder som Danfoss på Nordals. Kyst, bøgeskov og Flensborg Fjord præger landskabet.",
  },
  "0550": {
    stoersteBy: "Tønder",
    beskrivelse:
      "Tønder Kommune ligger i den sydvestligste del af Danmark ved grænsen til Tyskland. Kommunen omfatter bl.a. Tønder, Skærbæk, Toftlund og øen Rømø. Vadehavet, som er på UNESCOs verdensarvsliste, og Rømøs brede strande tiltrækker mange besøgende. Tønder er kendt for sin musikfestival og gamle gavlhuse, og marsken med den sorte sol er et kendt naturfænomen.",
  },
  "0561": {
    stoersteBy: "Esbjerg",
    beskrivelse:
      "Esbjerg Kommune ligger i Sydvestjylland ud til Vadehavet og omfatter bl.a. Esbjerg, Ribe og Bramming. Esbjerg er Danmarks energimetropol med en stor havn for offshore og havvind. Ribe er Danmarks ældste by med domkirke og velbevaret middelaldermiljø. Vadehavet og Mennesket ved Havet er kendte oplevelser.",
  },
  "0563": {
    stoersteBy: "Nordby",
    beskrivelse:
      "Fanø Kommune omfatter øen Fanø ud for Esbjerg i Vadehavet. Øen er kendt for sine brede sandstrande, klitter og hyggelige byer som Nordby og Sønderho. Fanø har en lang søfartstradition og mange gamle kaptajnshuse. Færgen til Esbjerg tager kun få minutter, og turisme er et vigtigt erhverv.",
  },
  "0573": {
    stoersteBy: "Varde",
    beskrivelse:
      "Varde Kommune ligger i Vestjylland og omfatter bl.a. Varde, Oksbøl, Ølgod og kystbyer som Blåvand og Henne Strand. Kommunen har en lang Vesterhavskyst med strande, klitter og store sommerhusområder. Blåvandshuk Fyr og Tirpitz-museet er populære attraktioner. Landbrug, turisme og industri er vigtige erhverv.",
  },
  "0575": {
    stoersteBy: "Vejen",
    beskrivelse:
      "Vejen Kommune ligger i Sydjylland og omfatter bl.a. Vejen, Brørup, Rødding og Holsted. Kommunen er præget af landbrug, industri og mindre byer. Vejen er kendt for Vejen Kunstmuseum, og Kongeåen, der tidligere var grænse til Tyskland, løber gennem kommunen. Motorvejen og jernbanen mellem Kolding og Esbjerg går gennem kommunen.",
  },
  "0580": {
    stoersteBy: "Aabenraa",
    beskrivelse:
      "Aabenraa Kommune ligger i Sønderjylland ved grænsen til Tyskland og omfatter bl.a. Aabenraa, Rødekro, Padborg og Tinglev. Aabenraa ligger ved en dyb fjord og har en stor havn og Sygehus Sønderjylland. Padborg er et vigtigt center for transport og logistik over grænsen. Kommunen har skove, fjord og landbrugsland.",
  },
  "0607": {
    stoersteBy: "Fredericia",
    beskrivelse:
      "Fredericia Kommune ligger ved Lillebælt i Trekantområdet og er et af landets vigtigste knudepunkter for jernbane og motorvej. Fredericia er kendt for sine velbevarede fæstningsvolde og planlagte bygader. Byen har en stor havn og betydelig industri. Kommunen har kyst og natur langs Lillebælt.",
  },
  "0621": {
    stoersteBy: "Kolding",
    beskrivelse:
      "Kolding Kommune ligger i Trekantområdet ved Kolding Fjord og omfatter bl.a. Kolding, Christiansfeld, Vamdrup og Lunderskov. Kolding er kendt for Koldinghus, designuddannelser og en stor handelsby. Christiansfeld er en brødremenighedsby på UNESCOs verdensarvsliste. Motorvej og jernbane gør kommunen let tilgængelig.",
  },
  "0630": {
    stoersteBy: "Vejle",
    beskrivelse:
      "Vejle Kommune ligger i Trekantområdet ved Vejle Fjord og omfatter bl.a. Vejle, Give, Jelling, Børkop og Egtved. Vejle er kendt for sin markante arkitektur ved havnen, Vejle Fjordbro og de bakkede omgivelser. Jellingmonumenterne med runesten og kongehøje er på UNESCOs verdensarvsliste. Kommunen er et stort erhvervs- og handelscentrum.",
  },

  // --- Region Midtjylland ---
  "0615": {
    stoersteBy: "Horsens",
    beskrivelse:
      "Horsens Kommune ligger i Østjylland ved Horsens Fjord og omfatter bl.a. Horsens, Brædstrup og Gedved. Horsens er en tidligere fængselsby, og FÆNGSLET er i dag et museum og kulturcenter. Byen er kendt for store koncerter og sin placering mellem Aarhus og Trekantområdet. Kommunen har fjord, skove og landbrugsland.",
  },
  "0657": {
    stoersteBy: "Herning",
    beskrivelse:
      "Herning Kommune ligger i Midtjylland og omfatter bl.a. Herning, Aulum, Sunds og Kibæk. Herning er kendt for MCH Messecenter Herning, Jyske Bank Boxen og en stærk tekstil- og erhvervshistorie. HEART – Herning Museum of Contemporary Art ligger i byen. Kommunen har hedelandskab, plantager og søer.",
  },
  "0661": {
    stoersteBy: "Holstebro",
    beskrivelse:
      "Holstebro Kommune ligger i Vestjylland og omfatter bl.a. Holstebro, Vinderup og Ulfborg. Holstebro er kendt for sin satsning på kunst og kultur med skulpturer i byrummet og Holstebro Kunstmuseum. Byen har en garnison og et aktivt handelsliv. Kommunen har varieret natur med Storå, hede og plantager.",
  },
  "0665": {
    stoersteBy: "Lemvig",
    beskrivelse:
      "Lemvig Kommune ligger i Vestjylland mellem Limfjorden og Vesterhavet og omfatter bl.a. Lemvig, Harboøre og Thyborøn. Thyborøn er en vigtig fiskerihavn, og Harboøre er kendt for sin fiskerkultur. Kysten har markante klitter og Jyllandsakvariet. Lemvig ligger smukt i et bakket landskab ved Limfjorden.",
  },
  "0671": {
    stoersteBy: "Struer",
    beskrivelse:
      "Struer Kommune ligger ved Limfjorden i Vestjylland og omfatter bl.a. Struer og Hvidbjerg på Thyholm samt øen Venø. Struer er kendt for sin lydteknologi og historien bag Bang & Olufsen. Byen er et jernbaneknudepunkt i Vestjylland. Kommunen har fjordlandskab, landbrug og små landsbyer.",
  },
  "0706": {
    stoersteBy: "Ebeltoft",
    beskrivelse:
      "Syddjurs Kommune ligger på Djursland øst for Aarhus og omfatter bl.a. Ebeltoft, Rønde, Hornslet og Kolind. Kommunen er kendt for Mols Bjerge Nationalpark, Glasmuseet og fregatten Jylland i Ebeltoft. Kysten har mange strande og sommerhusområder. Kalø Slotsruin og Rosenholm Slot ligger også i kommunen.",
  },
  "0707": {
    stoersteBy: "Grenaa",
    beskrivelse:
      "Norddjurs Kommune ligger på den nordlige og østlige del af Djursland og omfatter bl.a. Grenaa, Auning og Ørsted. Grenaa har havn med færge til Anholt, og øen Anholt hører til kommunen. Kommunen er kendt for Kattegatcentret, Djurs Sommerland og Gammel Estrup Herregårdsmuseum. Kysten mod Kattegat har populære strande.",
  },
  "0710": {
    stoersteBy: null,
    beskrivelse:
      "Favrskov Kommune ligger nordvest for Aarhus og omfatter bl.a. Hinnerup, Hadsten, Hammel og Ulstrup. Kommunen er præget af mindre byer, landsbyer og landbrug og er populær blandt pendlere til Aarhus. Gudenåen løber gennem den vestlige del af kommunen. Frijsenborg Gods og Lilleåens dal byder på natur og kulturhistorie.",
  },
  "0727": {
    stoersteBy: "Odder",
    beskrivelse:
      "Odder Kommune ligger syd for Aarhus og omfatter bl.a. Odder, Hou og Saksild samt øen Tunø. Kommunen har en lang kyst mod Kattegat med strande og sommerhusområder. Letbanen forbinder Odder med Aarhus. Landbrug og mindre virksomheder præger erhvervslivet.",
  },
  "0730": {
    stoersteBy: "Randers",
    beskrivelse:
      "Randers Kommune ligger i Østjylland ved Randers Fjord og Gudenåen og omfatter bl.a. Randers, Langå og Spentrup. Randers er en af Danmarks største byer og kendt for Randers Regnskov samt en lang handels- og industrihistorie. Randers Fjord og Gudenåen præger landskabet. Byen er knudepunkt for tog og motorvej.",
  },
  "0740": {
    stoersteBy: "Silkeborg",
    beskrivelse:
      "Silkeborg Kommune ligger midt i Jylland og omfatter bl.a. Silkeborg, Kjellerup, Them og Gjern. Silkeborg er kendt for Søhøjlandet med søer, skove og Gudenåen. Museum Jorn og Tollundmanden på Silkeborg Museum er kendte attraktioner. Kommunen er en af landets største i areal og har et aktivt friluftsliv.",
  },
  "0741": {
    stoersteBy: "Tranebjerg",
    beskrivelse:
      "Samsø Kommune omfatter øen Samsø i Kattegat. Øen er kendt for sine tidlige kartofler, sin rolle som vedvarende energi-ø og et smukt landskab med landsbyer og kyst. Tranebjerg er øens største by, mens Ballen og Nordby er hyggelige besøgsmål. Færger forbinder Samsø med Hou og Kalundborg.",
  },
  "0746": {
    stoersteBy: "Skanderborg",
    beskrivelse:
      "Skanderborg Kommune ligger sydvest for Aarhus og omfatter bl.a. Skanderborg, Ry, Hørning og Galten. Kommunen er kendt for Smukfest i Dyrehaven ved Skanderborg og for søerne i Søhøjlandet omkring Ry og Himmelbjerget. Tog og motorvej gør pendling til Aarhus let. Kommunen har et grønt præg med søer, skove og ådale.",
  },
  "0751": {
    stoersteBy: "Aarhus",
    beskrivelse:
      "Aarhus Kommune er Danmarks næststørste kommune og centrum for Østjylland. Aarhus er en universitetsby med Aarhus Universitet og et stort hospital, og byen har et rigt kulturliv med bl.a. ARoS og Den Gamle By. Havnefronten med Dokk1 og Aarhus Ø er udbygget de seneste år. Letbanen forbinder byen med omegnen, og skove og strande ligger tæt på centrum.",
  },
  "0756": {
    stoersteBy: "Ikast",
    beskrivelse:
      "Ikast-Brande Kommune ligger i Midtjylland og omfatter bl.a. Ikast, Brande, Bording og Nørre Snede. Kommunen har en stærk tekstil- og erhvervshistorie, og Brande er kendt som hjemby for flere store virksomheder. Landskabet er præget af hede, plantager og ådale. Motorvejen og jernbanen forbinder kommunen med Herning og Østjylland.",
  },
  "0760": {
    stoersteBy: "Ringkøbing",
    beskrivelse:
      "Ringkøbing-Skjern Kommune er landets største kommune i areal og ligger i Vestjylland ud mod Vesterhavet. Kommunen omfatter bl.a. Ringkøbing, Skjern, Tarm og Hvide Sande ved Ringkøbing Fjord. Skjern Enge er et af Nordeuropas største genoprettede vådområder. Kysten er et populært område for surfing, fiskeri og sommerhusferie.",
  },
  "0766": {
    stoersteBy: "Hedensted",
    beskrivelse:
      "Hedensted Kommune ligger i Østjylland mellem Horsens og Vejle og omfatter bl.a. Hedensted, Juelsminde, Tørring og Løsning. Kommunen har kyst mod Vejle Fjord og Kattegat med sommerhusområder og havnen i Juelsminde. Mange små og mellemstore virksomheder præger erhvervslivet. Motorvejen giver hurtig forbindelse i begge retninger.",
  },
  "0779": {
    stoersteBy: "Skive",
    beskrivelse:
      "Skive Kommune ligger ved Limfjorden i Nordvestjylland og omfatter bl.a. Skive, Roslev og halvøerne Salling og Fur. Øen Fur er kendt for sine moler-klinter med fossiler. Skive har en aktiv erhvervsby med satsning på energi og grøn omstilling. Kommunen har lange fjordkyster og mange landsbyer.",
  },
  "0791": {
    stoersteBy: "Viborg",
    beskrivelse:
      "Viborg Kommune ligger midt i Jylland og omfatter bl.a. Viborg, Bjerringbro, Karup og Stoholm. Viborg er en af Danmarks ældste byer med domkirke og er centrum for regionens administration og retsvæsen. Kommunen har mange søer, skove og hedeområder, bl.a. Hald Sø. Karup er kendt for flyvestation og lufthavn.",
  },

  // --- Region Nordjylland ---
  "0773": {
    stoersteBy: "Nykøbing Mors",
    beskrivelse:
      "Morsø Kommune omfatter øen Mors i Limfjorden. Nykøbing Mors er øens største by med havn og handel. Øen er kendt for sine moler-klinter ved Hanklit med fossiler og for sin rige natur og fjordkyst. Broer forbinder Mors med Thy og Salling.",
  },
  "0787": {
    stoersteBy: "Thisted",
    beskrivelse:
      "Thisted Kommune ligger i Thy i Nordvestjylland og omfatter bl.a. Thisted, Hanstholm og Hurup. Kommunen rummer en stor del af Nationalpark Thy med klitter, hede og Vesterhavskyst. Hanstholm er en vigtig fiskerihavn, og Klitmøller er kendt for surfing. Thisted har et aktivt handels- og erhvervsliv ved Limfjorden.",
  },
  "0810": {
    stoersteBy: "Brønderslev",
    beskrivelse:
      "Brønderslev Kommune ligger i Vendsyssel nord for Aalborg og omfatter bl.a. Brønderslev, Dronninglund og Hjallerup. Kommunen er præget af landbrug, fødevarer og mindre industri. Hjallerup Marked er et af landets største markeder. Store Vildmose og Dronninglund Storskov giver gode naturoplevelser.",
  },
  "0813": {
    stoersteBy: "Frederikshavn",
    beskrivelse:
      "Frederikshavn Kommune ligger i den nordøstlige del af Vendsyssel og omfatter bl.a. Frederikshavn, Skagen og Sæby. Frederikshavn har havn med færger til Sverige og Norge, og Skagen er kendt for Grenen og Skagensmalerne. Sæby er en idyllisk købstad ved Kattegat. Fiskeri, maritime erhverv og turisme er vigtige for kommunen.",
  },
  "0820": {
    stoersteBy: "Aars",
    beskrivelse:
      "Vesthimmerlands Kommune ligger i Himmerland og omfatter bl.a. Aars, Farsø, Løgstør og Aalestrup. Kommunen har lang kyst mod Limfjorden, bl.a. ved Løgstør og Aggersund. Himmerland Golf & Spa Resort ligger ved Farsø. Landbrug og fødevareproduktion præger erhvervslivet.",
  },
  "0825": {
    stoersteBy: "Byrum",
    beskrivelse:
      "Læsø Kommune omfatter øen Læsø i Kattegat og er landets mindste kommune målt på indbyggere. Øen er kendt for sine tangtage, saltsyderiet og Læsø-jomfruhummere. Naturen byder på strand, klit, hede og store fugleområder. Færgen fra Vesterø Havn forbinder øen med Frederikshavn.",
  },
  "0840": {
    stoersteBy: "Støvring",
    beskrivelse:
      "Rebild Kommune ligger syd for Aalborg og omfatter bl.a. Støvring, Skørping og Nørager. Kommunen er kendt for Rebild Bakker og Rold Skov, en af Danmarks største skove, hvor Rebildfesten afholdes. Store naturområder og vandreture gør kommunen populær for friluftsliv. Støvring og Skørping har togforbindelse til Aalborg.",
  },
  "0846": {
    stoersteBy: "Hobro",
    beskrivelse:
      "Mariagerfjord Kommune ligger omkring Mariager Fjord og omfatter bl.a. Hobro, Mariager, Hadsund og Arden. Mariager er kendt som Rosernes By, og Hobro ligger for enden af fjorden. Fjorden, skovene og Fyrkat vikingeborg ved Hobro er vigtige attraktioner. Tog og motorvej forbinder kommunen med Aalborg og Randers.",
  },
  "0849": {
    stoersteBy: "Aabybro",
    beskrivelse:
      "Jammerbugt Kommune ligger i Nordjylland ud mod Vesterhavet og omfatter bl.a. Aabybro, Brovst, Fjerritslev og kystbyer som Blokhus, Rødhus og Slettestrand. Kysten har brede sandstrande, hvor man kan køre på stranden, og mange sommerhusområder. Fårup Sommerland ligger i kommunen. Landbrug, turisme og pendling mod Aalborg præger kommunen.",
  },
  "0851": {
    stoersteBy: "Aalborg",
    beskrivelse:
      "Aalborg Kommune ligger ved Limfjorden og er Nordjyllands største by og regionale centrum. Aalborg er en universitetsby med Aalborg Universitet og Aalborg Universitetshospital, og byen har et rigt kulturliv med bl.a. Utzon Center og Kunsten. Havnefronten er omdannet til byrum og boliger. Aalborg Lufthavn og motorvejsforbindelser gør kommunen let tilgængelig.",
  },
  "0860": {
    stoersteBy: "Hjørring",
    beskrivelse:
      "Hjørring Kommune ligger i Vendsyssel og omfatter bl.a. Hjørring, Hirtshals, Sindal og Tårs. Hirtshals har en stor havn med færger til Norge og Nordsøen Oceanarium. Kysten byder på Rubjerg Knude Fyr og strande ved Løkken og Tversted. Hjørring er en handels- og uddannelsesby med sygehus.",
  },
};
