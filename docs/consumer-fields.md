# Consumer fields

What an end consumer has to carry for an electrical installation to be calculated rather than only
drawn. Compiled 2026-09-13.

**Status: reference, not a commitment.** Feature 001 is the structure editor and the project file;
it holds no figures at all, and nothing here is implemented. This document exists so that the two
fields the editor already writes — `typeId` and `typeName` — are understood as the anchor the rest
would hang from, and so a later catalog version can be designed without re-deriving this list.

The `UI label (uk)` column is the caption the field would carry on screen: the interface language is
Ukrainian (spec.md, _Assumptions_), so that is the name a user reads, while `Field` is the name the
code and the file format use.

The split between the two tables matters: a value that is the same for every fridge in the world
belongs to the **catalog type**, and a value that differs between this fridge and that one belongs
to the **node**. Putting a type-level figure on the node would mean typing it in 40 times per
project; putting a node-level figure on the type would make it a lie for every second installation.

## Fields on a catalog type

| Field              | UI label (uk)              | Unit            | Range or default                                                                                                                                       |
| ------------------ | -------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ratedPower`       | Номінальна потужність      | W               | 3 … 11000. No global default — it is the defining figure of the type (LED downlight 7, kettle 2000, induction hob 7400, EV charger 7400)               |
| `voltage`          | Напруга                    | V               | 230 or 400. Default 230                                                                                                                                |
| `phases`           | Кількість фаз              | count           | 1 or 3. Default 1; 3 for hobs above 7 kW and three-phase EV chargers                                                                                   |
| `powerFactor`      | Коефіцієнт потужності      | — (cos φ)       | 0.50 … 1.00. Default 1.00 resistive, 0.90 electronic, 0.75 motor                                                                                       |
| `loadClass`        | Характер навантаження      | enum            | `resistive` \| `motor` \| `electronic` \| `lighting`. Default `resistive`                                                                              |
| `inrushRatio`      | Кратність пускового струму | × rated current | 1 … 8. Default 1 resistive and lighting, 3 motor, 6 sealed compressor (fridge, heat pump, air conditioner)                                             |
| `breakerCurve`     | Характеристика розчеплення | enum            | `B` \| `C` \| `D`. Default `B`; `C` whenever `inrushRatio` ≥ 3                                                                                         |
| `demandFactor`     | Коефіцієнт попиту          | —               | 0.10 … 1.00. Default by category: lighting 0.90, socket groups 0.30, cooking 0.70, water heating 0.90, EV charging 1.00                                |
| `dedicatedCircuit` | Окрема лінія               | bool            | Default `false`. `true` for hob, oven, water heater, washing machine, dishwasher, EV charger                                                           |
| `rcdRequired`      | Потрібне ПЗВ               | bool            | Default `true`                                                                                                                                         |
| `rcdRating`        | Уставка ПЗВ                | mA              | 10 \| 30 \| 100 \| 300. Default 30; 10 for bathroom-only fixed loads                                                                                   |
| `rcdType`          | Тип ПЗВ                    | enum            | `AC` \| `A` \| `F` \| `B`. Default `A`; `B` for EV chargers, `F` for inverter appliances (heat pump, inverter air conditioner, modern washing machine) |
| `dutyMode`         | Режим роботи               | enum            | `continuous` \| `intermittent` \| `short-time`. Default `continuous`                                                                                   |
| `standbyPower`     | Потужність очікування      | W               | 0 … 20. Default 0                                                                                                                                      |

## Fields on a consumer node

| Field                      | UI label (uk)            | Unit | Range or default                                                                                                                                                   |
| -------------------------- | ------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `quantity`                 | Кількість                | pcs  | ≥ 1. Default 1. **Exists today**                                                                                                                                   |
| `note`                     | Нотатка                  | text | ≤ 2000 characters. Default empty. **Exists today**                                                                                                                 |
| `typeId`                   | Тип із довідника         | —    | The catalog row this node came from. **Exists today**, and is what every type-level field above would be read through                                              |
| `typeName`                 | Назва типу               | —    | A copy of the type's name, so the file stays readable when the type is gone. **Exists today**                                                                      |
| `powerOverride`            | Потужність (уточнена)    | W    | Optional. Default: `ratedPower` of the type. For the one appliance that is not the catalogue figure                                                                |
| `phaseAssignment`          | Призначення фази         | enum | `auto` \| `L1` \| `L2` \| `L3`. Default `auto`                                                                                                                     |
| `dedicatedCircuitOverride` | Окрема лінія (уточнення) | bool | Optional. Default: `dedicatedCircuit` of the type                                                                                                                  |
| `utilisationFactor`        | Коефіцієнт використання  | —    | 0.10 … 1.00. Default 1.00. How hard this particular installation drives the appliance                                                                              |
| `location`                 | Умови розміщення         | enum | `dry` \| `damp` \| `wet` \| `outdoor`. Default `dry`. Drives the RCD rating, and belongs to the node because it is a property of where it hangs, not of what it is |

## Two notes worth keeping

**Diversity is applied per panel, not per consumer.** `demandFactor` says how much of one appliance's
rating counts; diversity (коефіцієнт одночасності) says how unlikely it is that a whole floor peaks
at once. The second is a property of the panel, so it does not appear in either table above — it
would be a field on the panel node.

**Nothing here requires the user to type a number.** Every figure has either a type-level default or
a derivation. That is the whole argument for `typeId`: without it each of these would become a form
field on every consumer, and a 40-node project would be 400 manual entries.
