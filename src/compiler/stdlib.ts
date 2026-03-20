export const STDLIB: Record<string, string> = {
  'std/orchestra': `tenuto "3.0" {
  group "Keyboards" {
    def pno "Piano" patch="acoustic_grand_piano"
    def epno "Electric Piano" patch="electric_piano_1"
    def org "Organ" patch="church_organ"
    def hps "Harpsichord" patch="harpsichord"
  }
  group "Woodwinds" {
    def fl "Flute" patch="flute"
    def ob "Oboe" patch="oboe"
    def cl "Clarinet" patch="clarinet"
    def bsn "Bassoon" patch="bassoon"
  }
  group "Brass" {
    def hn "Horn" patch="french_horn"
    def tpt "Trumpet" patch="trumpet"
    def tbn "Trombone" patch="trombone"
    def tba "Tuba" patch="tuba"
  }
  group "Strings" {
    def vln1 "Violin I" patch="violin"
    def vln2 "Violin II" patch="violin"
    def vla "Viola" patch="viola"
    def vc "Cello" patch="cello"
    def cb "Contrabass" patch="contrabass"
  }
}`
};
