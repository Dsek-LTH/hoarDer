# hoarDer
Stockkeeping backend for the D-Guild

# Roadmap

- [?] lista inventarier för olika mästerier
- [x] stöd för att registrera hyllplats el. likn.
- [x] stöd för nästlade inventarier, t.ex. verktygslåda med verktyg i
- [x] stöd för att koppla QR-kod till en inventarie
- [x] stöd för många instanser av samma produkt, t.ex. läskburkar
- [x] stöd för att berätta vad som är "rätt" plats vid incheckning
- [x] stöd för att checka ut/in inventarier mha QR-kod
- [x] kom ihåg vem som checkade ut en inventarie senast
- [ ] kom ihåg vem som checkade in en inventarie
- [ ] koppla ekonmiskt värde till större inventarier (?)
- [ ] inventariecheck - diffa mot verkligheten, upptäck svinn
- [ ] generera menyer för pubar baserat på utcheckade varor
- [ ] generera internfakturor för utcheckning av jobbardricka

# Setup
Lägg rätt [https://github.com/neo4j-contrib/neo4j-apoc-procedures](APOC-jarfil) i ./plugins.

# Tankar bakom
Allt som inte är produkter eller inventarier är Containers. Verktygslådor, hyllor, rum - potentiellt även mästerier - är Containers, som kan nästlas (i teorin) oändligt djupt. I verkligheten är djupet begränsat till 20 nivåer. Detta är inte en hård gräns, men vissa queries som returnerar listor kollar inte längre än 20 nivåer för att inte balla ur i oändligheten om det skulle råka komma in loopar i databasen.

Användare är också Containers. När man checkar ut en produkt är det alltså bara att flytta inventarien till användar-containern för den som checkar ut. Man behöver bara se till att det finns en container för den användaren också. Det lär det komma en dedikerad mutation för senare, som automatiskt skapar en användar-container om den inte redan finns, och dessutom kollar autentisering hos den som checkar in/ut.
