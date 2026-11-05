# Folyam Studio – „Áramlás” változat

## Kinek szól, mi a dolga
Magyar kisvállalkozónak (pék, virágos, borbély, asztalos, kis szállás), és bárkinek, aki eldönti, hogy két egyetemistára rábízza-e a weboldalát.
Egyetlen feladata: a látogató **saját szemével lássa**, hogy értünk a weboldalakhoz, és írjon nekünk.
Ez a bemutatóterem. Hangsúlyozzuk is: egy pékség oldalára nem tennénk rá mindezt, annak gyorsnak és egyszerűnek kell lennie.

## Koncepció
„Folyam” = áramlás. São Miguel szigetén, Furnasban a föld gőzt ereget, a kén sárgára festi a köveket.
Az oldal egy folyam: a nyitóképen részecskékből álló áramlás formálja ki a FOLYAM szót, és görgetésre lefelé sodródik.
Ugyanez az áramlás viszi végig a látogatót: egy nyers ötletből telefonon élő weboldal lesz (3D telefon), egy üzenetből e-mail és táblázatsor (a kapcsolatfelvételnél élőben).

## Színek (szerep szerint)
| név | érték | szerep |
|---|---|---|
| gőz | `#ECEAE3` | világos alap, a papír |
| bazalt | `#151819` | szöveg, sötét szekciók alapja |
| kén | `#D9B21F` | az egyetlen kiemelő szín: fókusz, aktív állapot, a folyam „magja” |
| zuzmó | `#8C9878` | másodlagos vonalak, halvány jelölések sötét alapon |
| kalderató | `#18302E` | mély zöld, csak a 3D-s telefonszekció háttere |
| hamu | `#6B6E6A` | másodlagos szöveg világos alapon |

Nincs színátmenetes szöveg, nincs lila-kék, nincs üveghatás.

## Betűk (self-hostolva, latin-ext)
- Cím: **Bricolage Grotesque** (változó: wght, wdth, opsz). A címek szélessége a görgetés sebességére reagál.
- Törzs: **IBM Plex Sans** 400/500/600.
- Adat (órák, mérések, csővezeték): **JetBrains Mono** (változó).

## Nyitás
A teljes képernyőn a kén színű és gőzfehér részecskék folyama kirajzolja a FOLYAM szót. Az egér örvényt kavar benne, görgetésre a betűk feloldódnak és lefelé folynak.

## Mozgás és őszinteség
- `prefers-reduced-motion: reduce` esetén minden folyamatos mozgás áll, statikus képkocka marad.
- Képernyőn kívüli WebGL szünetel, a DPR legfeljebb 2.
- Nincs kitalált statisztika, ügyfél vagy vélemény. A teljesítménymérő a látogató saját gépén mért valódi számokat mutatja.
- Nincsenek fotók: minden kép kódból generált (nincs licencgond, és ez is a mesterség bemutatása).
