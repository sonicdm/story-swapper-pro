#!/usr/bin/env node
/** One-time seed: writes madlib-originals/generic and themed/*.json */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'madlib-originals');

const GENERIC = [
  {
    title: "Doctor's Report",
    text: [
      "## Doctor's Report\n\n**Patient presentation:** Patient presents with a ",
      " ",
      " ache near the ",
      ".\n\n**Vital signs:** ",
      " and slightly ",
      ".\n\n**Treatment:** Rest, ",
      " fluids, and one small ",
      " taken ",
      " with meals.\n\n**Follow-up:** Follow up if symptoms become ",
      " or if the patient begins to ",
      " uncontrollably at work.\n\n**Notes:** Patient insists this started after eating ",
      " at a ",
      " restaurant. Prescription signed with a ",
      " pen."
    ],
    blanks: ["adjective", "body part", "body part", "adjective", "adjective", "adjective", "object", "adverb", "adjective", "verb", "food", "adjective", "color"]
  },
  {
    title: "Horoscope",
    text: [
      "## Today's Horoscope\n\n**Sign:** ",
      " signs\n\n**Opportunity:** A ",
      " stranger may offer you a ",
      " opportunity near a ",
      ".\n\n**Lucky charm:** Your lucky ",
      " is hiding inside an old ",
      ".\n\n**Romance:** Romance blooms when you ",
      " with confidence and wear something ",
      ".\n\n**Warning:** Beware of ",
      " advice from a ",
      " relative.\n\n**Finance:** Financial luck arrives after you ",
      " a forgotten ",
      ".\n\n**Tonight:** Dream of ",
      " animals and wake up feeling ",
      "."
    ],
    blanks: ["adjective", "adjective", "adjective", "place", "object", "object", "verb", "adjective", "adjective", "adjective", "verb", "object", "plural noun", "adjective"]
  },
  {
    title: "How to Host a Party",
    text: [
      "## How to Host a Party\n\n**Step 1:** Send ",
      " invitations written in ",
      " ink.\n\n**Step 2:** Decorate with ",
      " balloons and a banner that says WELCOME ",
      " PEOPLE.\n\n**Step 3:** Prepare ",
      " snacks and a punch bowl full of ",
      " liquid.\n\n**Step 4:** Create a playlist of ",
      " songs from the year you last ",
      " in public.\n\n**Step 5:** Hide breakable ",
      " objects on the highest ",
      ".\n\n**Step 6:** When guests arrive, greet them with a ",
      " handshake and offer a ",
      ".\n\n**Step 7:** End the night by ",
      " politely and eating leftover ",
      "."
    ],
    blanks: ["adjective", "color", "adjective", "plural noun", "adjective", "type of liquid", "adjective", "verb ending in 'ing'", "plural noun", "place", "adjective", "object", "verb ending in 'ing'", "food"]
  },
  {
    title: "Movie Review",
    text: [
      "## Movie Review\n\nCritics call it the most ",
      " film of the season.\n\n**Starring:** ",
      " as a ",
      " hero who must ",
      " across a ",
      " landscape to recover a stolen ",
      ".\n\n**Villain:** Played by a ",
      " celebrity, who wants to ",
      " the world using only a ",
      " and poor timing.\n\n**Best scene:** A ",
      " chase through a ",
      " while ",
      " music swells.\n\n**Worst scene:** Someone tries to ",
      " a ",
      " and fails.\n\n**Rating:** ",
      " stars and one ",
      " popcorn bucket."
    ],
    blanks: ["adjective", "name", "adjective", "verb", "adjective", "object", "adjective", "verb", "object", "adjective", "place", "adjective", "verb", "animal", "number", "adjective"]
  },
  {
    title: "Weather Forecast",
    text: [
      "## Weather Forecast\n\nGood evening. Tomorrow expect ",
      " skies over the ",
      " valley with ",
      " winds from the ",
      ".\n\n**Commuters:** Carry a ",
      " and avoid ",
      " puddles near the ",
      ".\n\n**Temperatures:** Will feel ",
      " before lunch, then become ",
      " by evening.\n\n**Chance of precipitation:** ",
      " percent chance of ",
      " falling on anyone who forgot to ",
      ".\n\n**Weekend outlook:** Mostly ",
      " with isolated ",
      " and one heroic ",
      " saving a ",
      " from a tree."
    ],
    blanks: ["adjective", "adjective", "adjective", "place", "clothing item", "adjective", "place", "adjective", "adjective", "number", "plural noun", "verb", "adjective", "plural noun", "animal", "object"]
  },
  {
    title: "Restaurant Complaint",
    text: [
      "## Restaurant Complaint\n\nDear Manager,\n\nI visited your ",
      " restaurant last ",
      " and ordered the chef's ",
      " special.\n\n**The soup:** Tasted like ",
      " mixed with ",
      " and was served at a ",
      " temperature.\n\n**Service:** My server, who wore ",
      " shoes, forgot to ",
      " our table twice.\n\n**Dessert:** We received a ",
      " that looked like a small ",
      ".\n\n**The check:** When I asked for the bill, the total seemed ",
      ". Please refund my ",
      " and consider hiring a ",
      " host who can ",
      " without causing panic."
    ],
    blanks: ["adjective", "place", "adjective", "food", "food", "adjective", "color", "verb", "object", "animal", "adjective", "number", "adjective", "verb"]
  },
  {
    title: "Instruction Manual",
    text: [
      "## Instruction Manual\n\n**WARNING:** Do not ",
      " this ",
      " near water, bees, or emotional ",
      " people.\n\n**Step A:** Insert the ",
      " into slot ",
      " until you hear a ",
      " sound.\n\n**Step B:** Press the ",
      " button firmly with your ",
      ".\n\n**Step C:** Wait ",
      " minutes while the device becomes ",
      ".\n\n**Step D:** If smoke appears, ",
      " calmly toward the nearest ",
      ".\n\n**Maintenance:** Clean with a ",
      " cloth every ",
      " days.\n\n**Support:** Questions? Call our ",
      " support line and ask for ",
      "."
    ],
    blanks: ["verb", "object", "adjective", "object", "number", "adjective", "color", "body part", "number", "adjective", "verb", "place", "adjective", "number", "adjective", "name"]
  },
  {
    title: "Quiz Show",
    text: [
      "## Quiz Show\n\nWelcome to *Who Wants to Be ",
      "!*\n\n**Contestant:** ",
      " from ",
      ", a professional ",
      " with strong opinions about ",
      ".\n\n**For one thousand points:** Name a ",
      " country famous for ",
      " exports.\n\n**For ten thousand:** Spell a ",
      " word while ",
      " on one foot.\n\n**Lifeline:** Phone-a-",
      " went to voicemail.\n\n**Final question:** If a ",
      " train leaves at ",
      " o'clock carrying ",
      " passengers, how many will sing?\n\n**Answer:** ",
      " — because this show makes no ",
      " sense."
    ],
    blanks: ["adjective", "name", "a place", "job", "plural noun", "foreign country", "adjective", "adjective", "verb ending in 'ing'", "name", "adjective", "number", "number", "number", "adjective"]
  },
  {
    title: "Obituary",
    text: [
      "## Obituary\n\nIn loving memory of ",
      ", who passed peacefully after a long battle with ",
      " laundry and an aggressive ",
      " collection.\n\n**Early life:** Born in a ",
      " hospital, they spent youth ",
      " through fields of ",
      " and dreaming of ",
      ".\n\n**Career:** They worked as a ",
      " for ",
      " years, retiring to pursue ",
      " and competitive ",
      ".\n\n**Survived by:** ",
      " cousins, one ",
      " dog, and a goldfish named ",
      ".\n\n**Services:** Will be held at ",
      " Cemetery. In lieu of flowers, send ",
      " and kind ",
      "."
    ],
    blanks: ["name", "adjective", "plural noun", "adjective", "verb ending in 'ing'", "plural noun", "plural noun", "job", "number", "verb ending in 'ing'", "plural noun", "number", "adjective", "name", "a place", "food", "plural noun"]
  },
  {
    title: "Travel Brochure",
    text: [
      "## Travel Brochure\n\nDiscover ",
      ", the ",
      " destination where every sunrise looks ",
      " and every taxi driver knows a ",
      " shortcut.\n\n**Accommodations:** Stay at the Hotel ",
      " featuring ",
      " pools and complimentary ",
      ".\n\n**Activities:**\n- ",
      " on the beach\n- Touring ancient ",
      " ruins\n- Sampling local ",
      " served on a ",
      " plate\n\n**What to pack:** ",
      " clothing, sturdy ",
      ", and patience.\n\n**Warning:** Tourists who ",
      " too loudly may be followed home by ",
      " birds.\n\n**Book now** and receive a free ",
      "!"
    ],
    blanks: ["a place", "adjective", "adjective", "adjective", "adjective", "adjective", "plural noun", "verb ending in 'ing'", "adjective", "food", "adjective", "adjective", "clothing item", "verb", "adjective", "object"]
  },
  {
    title: "Help Wanted Ad",
    text: [
      "## Help Wanted\n\nNow hiring a ",
      " ",
      " to join our ",
      " team downtown.\n\n**Requirements:**\n- Must be able to ",
      " quickly\n- Lift ",
      " pounds\n- Remain ",
      " during emergencies involving ",
      " or spilled ",
      "\n\n**Benefits:**\n- ",
      " dental\n- Unlimited ",
      "\n- One ",
      " holiday per month\n\n**How to apply:** In person wearing ",
      " attire with a ",
      " resume.\n\n**Ideal candidate:** ",
      " years experience; can ",
      " without supervision. No ",
      " applicants, please."
    ],
    blanks: ["adjective", "job", "adjective", "verb", "number", "adjective", "plural noun", "type of liquid", "adjective", "plural noun", "adjective", "adjective", "object", "number", "verb", "adjective"]
  },
  {
    title: "School Permission Slip",
    text: [
      "## School Permission Slip\n\nDear Parent,\n\nOur class will visit the ",
      " Museum of ",
      " on ",
      "day.\n\n**Students should bring:**\n- A ",
      " lunch\n- A ",
      " water bottle\n- ",
      " shoes\n\n**Itinerary:** We will ",
      " through the ",
      " exhibit and learn about ",
      " history.\n\n**Permission granted** to ride the ",
      " bus and participate in the ",
      " workshop.\n\n**Emergency contact:** ",
      " at ",
      " o'clock.\n\n**Note:** If your child is allergic to ",
      ", ",
      ", or enthusiasm, please inform us."
    ],
    blanks: ["adjective", "plural noun", "adjective", "adjective", "adjective", "adjective", "verb", "adjective", "adjective", "adjective", "adjective", "name", "number", "plural noun", "plural noun"]
  },
  {
    title: "Product Warning Label",
    text: [
      "## Product Warning\n\n**CAUTION:** This ",
      " may become ",
      " when exposed to sunlight, gossip, or ",
      " music.\n\n**Do not:**\n- ",
      " while operating a ",
      "\n- Negotiate with ",
      " people\n\n**Side effects:** ",
      " laughter, sudden urges to ",
      ", and believing you can ",
      " professionally.\n\n**Keep away from** ",
      " animals and open ",
      ".\n\n**If swallowed:** Contact a ",
      " immediately and describe the ",
      " flavor.\n\n**Storage:** Cool, ",
      " place away from children and ",
      " influencers."
    ],
    blanks: ["object", "adjective", "adjective", "verb", "vehicle", "adjective", "adjective", "verb", "verb", "adjective", "plural noun", "job", "adjective", "adjective", "adjective"]
  },
  {
    title: "Apology Letter",
    text: [
      "## Apology Letter\n\nDear ",
      ",\n\nI am deeply sorry for ",
      " your ",
      " during the ",
      " party.\n\nIt was wrong to ",
      " near the ",
      " and even worse to blame your ",
      ".\n\nI should not have ",
      " your favorite ",
      " or told everyone about the ",
      " incident.\n\n**To make amends** I will ",
      " publicly, replace the ",
      ", and never again ",
      " without permission.\n\nPlease forgive me.\n\nSincerely,\n",
      ", a reformed ",
      " person."
    ],
    blanks: ["name", "verb ending in 'ing'", "object", "adjective", "verb", "place", "animal", "verb", "object", "adjective", "verb", "object", "verb", "name", "adjective"]
  },
  {
    title: "Help Desk Ticket",
    text: [
      "## Help Desk Ticket\n\n**Caller:** ",
      "\n\n**Location:** ",
      " building, floor ",
      "\n\n**Priority:** ",
      "\n\n**Problem:** User cannot ",
      " — screen shows a ",
      " error about ",
      ".\n\n**Troubleshooting:**\n- Rebooted the ",
      "\n- Reseated the ",
      " cable\n- Asked them to ",
      " and try again\n\n**Resolution:** Replaced the ",
      " and cleared the ",
      " queue. Closed as ",
      ".\n\n**Time on ticket:** ",
      " minutes. User thanked us and asked if we also fix ",
      "."
    ],
    blanks: ["name", "adjective", "number", "adjective", "verb", "adjective", "plural noun", "object", "adjective", "verb", "adjective", "adjective", "adjective", "number", "plural noun"]
  },
  {
    title: "VPN Support Call",
    text: [
      "## VPN Support Call\n\n**Agent:** Thank you for calling ",
      " IT support. May I have your employee ",
      "?\n\n**User:** I cannot ",
      " from home. The ",
      " icon just spins.\n\n**Agent:** Please ",
      " your router, then ",
      " the VPN client.\n\n**User:** It asked for my ",
      " and then said access was ",
      ".\n\n**Agent:** I reset your ",
      " in Active Directory. Try ",
      " again in ",
      " minutes.\n\n**User:** It works! You are a ",
      " legend."
    ],
    blanks: ["adjective", "number", "verb", "adjective", "verb", "verb", "object", "adjective", "object", "verb", "number", "adjective"]
  },
  {
    title: "New Hire IT Setup",
    text: [
      "## New Hire IT Setup\n\n**Employee:** ",
      "\n\n**Start date:** ",
      "day\n\n**Hardware issued:**\n- ",
      " laptop with ",
      " monitor\n- ",
      " keyboard and wireless ",
      "\n\n**Accounts created:**\n- Email and ",
      " access\n- Badge: ",
      " wing, ",
      " floor\n\n**Training scheduled:**\n- ",
      " security awareness\n- How to ",
      " without breaking the ",
      "\n\n**Notes:** No admin rights on the ",
      ". Manager says they are ",
      " and should never receive ",
      " permissions."
    ],
    blanks: ["name", "adjective", "adjective", "adjective", "adjective", "object", "adjective", "adjective", "number", "adjective", "verb", "object", "object", "adjective", "adjective"]
  }
];

const THEMED = [
  {
    title: "Pet Sitter Instructions",
    text: [
      "## Pet Sitter Instructions\n\nThank you for watching **Matilda** (dark red golden retriever), **Violet** (tortie cat), and **Zebby** (black cat).\n\n**Matilda:** Needs ",
      " walks and one ",
      " treat after she ",
      " politely.\n\n**Violet:** Demands ",
      " food at exactly ",
      " o'clock and will ",
      " if ignored.\n\n**Zebby:** Hides in the ",
      " and attacks anything ",
      ".\n\n**Rules:** Do not ",
      " the vacuum near them. Emergency vet number is on the ",
      ".\n\n**Bonus:** If all three sit together peacefully, photograph it — it is ",
      " and probably a sign."
    ],
    blanks: ["adjective", "adjective", "verb", "adjective", "number", "verb", "place", "adjective", "verb", "object", "adjective"]
  },
  {
    title: "IT Incident Report",
    text: [
      "## IT Incident Report\n\n**Incident summary:** Company-wide ",
      " outage began at ",
      " AM after someone ",
      " the ",
      " server.\n\n**Root cause:** A ",
      " patch pushed by ",
      " during lunch.\n\n**User impact:** ",
      " employees unable to ",
      " for ",
      " minutes.\n\n**Timeline:** Tier-1 missed the alert because the queue was ",
      "; fix attempted by ",
      " the ",
      " twice.\n\n**Action items:**\n- Add ",
      " monitoring\n- Ban ",
      " changes on Fridays\n- Require ",
      " approval before rebooting anything\n\n**Blameless note:** The vendor swore the update was harmless.",
      "\n\n**Status:** Ticket closed."
    ],
    blanks: ["adjective", "number", "verb", "adjective", "object", "adjective", "name", "number", "verb", "number", "adjective", "verb", "object", "adjective", "plural noun", "adjective"]
  },
  {
    title: "Baby and Baby Bear Bedtime",
    text: [
      "## Bedtime Checklist\n\n**For Baby and Baby Bear:**\n\n- Draw a ",
      " bath\n- Find the ",
      " pajamas with ",
      " on them\n- Read one ",
      " story about ",
      " who learn to ",
      "\n\n**Baby Bear:** Requires ",
      " honey on a ",
      " spoon and will ",
      " if the room is too ",
      ".\n\n**Baby:** Prefers the ",
      " lullaby sung ",
      " while rocking the ",
      " chair.\n\n**Lights out:** ",
      " o'clock.\n\n**If either wakes up:** Offer a ",
      " hug and do not mention ",
      " until morning."
    ],
    blanks: ["adjective", "adjective", "plural noun", "adjective", "animal", "verb", "adjective", "adjective", "verb", "adjective", "adjective", "adverb", "adjective", "number", "adjective", "plural noun"]
  },
  {
    title: "AIM Away Message",
    text: [
      "## AIM Away Message\n\nbrb ",
      "ing 4 a while!!!\n\n**If u need me:** Prob at the ",
      " mall or fighting my ",
      " brother 4 the computer.\n\n**Current mood:** ",
      "\n\n**Listening 2:** ",
      " on my ",
      " CD player.\n\n**Leave a ",
      " if u wanna talk about ",
      ", homework, or who ",
      " who on the bus.\n\n**Back @** ",
      " unless dial-up is ",
      " again lol.\n\n**Auto-reply:** BRB DO NOT ",
      " MY PROFILE!!! ~*",
      " ~*"
    ],
    blanks: ["verb ending in 'ing'", "adjective", "adjective", "adjective", "plural noun", "adjective", "plural noun", "plural noun", "verb", "number", "adjective", "verb", "name"]
  },
  {
    title: "Dial-Up Internet Guide",
    text: [
      "## Dial-Up Internet Guide\n\nWelcome to the Internet!\n\n**Step 1:** Tell everyone in the house you will ",
      " the phone line for ",
      " hours.\n\n**Step 2:** Connect your ",
      " modem and listen for the ",
      " sound of progress.\n\n**Step 3:** Choose a ",
      " username like ",
      " and a password no one can ",
      ".\n\n**Step 4:** Download one ",
      " image very ",
      ".\n\n**Step 5:** Sign into chat and say hello to ",
      " strangers.\n\n**Step 6:** When a parent needs the phone, ",
      " quickly and blame the ",
      ".\n\nRepeat until broadband arrives in ",
      " years."
    ],
    blanks: ["verb", "number", "adjective", "adjective", "adjective", "name", "verb", "adjective", "adverb", "number", "verb", "object", "number"]
  },
  {
    title: "Matilda's Walk Report",
    text: [
      "## Walk Report\n\n**Dog:** Matilda (dark red golden retriever)\n\n**Weather:** ",
      " with a chance of ",
      ".\n\n**Route:** Left on ",
      " Street, past the ",
      " park, then home for ",
      " treats.\n\n**Highlights:** Matilda ",
      " at a ",
      " squirrel and made ",
      " new friends.\n\n**Lowlights:** She rolled in something ",
      " near a ",
      ".\n\n**Equipment:** ",
      " leash, ",
      " bag, one heroic ",
      ".\n\n**Owner mood:** ",
      ".\n\n**Recommendation:** More walks, fewer ",
      " distractions."
    ],
    blanks: ["adjective", "plural noun", "adjective", "adjective", "adjective", "verb", "adjective", "number", "adjective", "place", "adjective", "adjective", "object", "adjective", "plural noun"]
  },
  {
    title: "Violet's Demand List",
    text: [
      "## Official Demands\n\n*From Violet the tortie cat:*\n\n**Breakfast:** Must include ",
      " food served in the ",
      " bowl only.\n\n**Sunbeam:** The sunbeam on the ",
      " belongs to Violet from ",
      " AM to ",
      " PM.\n\n**Staff rules:**\n- ",
      " before entering the room\n- Avoid ",
      " noises\n\n**Petting:** Allowed only on the ",
      " for ",
      " seconds.\n\n**Zebby:** May not ",
      " near Violet's ",
      ".\n\n**Violations:** ",
      " stares and one ",
      " item knocked off a shelf.\n\nSigned with a ",
      " paw print."
    ],
    blanks: ["adjective", "adjective", "place", "number", "number", "verb", "adjective", "body part", "number", "verb", "place", "adjective", "adjective", "color"]
  },
  {
    title: "Zebby's Incident Report",
    text: [
      "## Incident Report\n\n**Filed by:** Zebby, black cat\n\n**Time:** ",
      " o'clock\n\n**Location:** The ",
      " near the ",
      "\n\n**Event:** Human attempted to ",
      " without offering ",
      " first.\n\n**Witnesses:**\n- Matilda (",
      ")\n- Violet (",
      ")\n\n**Response:** Zebby ",
      " under the couch, then ",
      " the offender's ",
      ".\n\n**Damage:** One ",
      " knocked over, zero regrets.\n\n**Corrective action:** Schedule ",
      " play sessions; stop buying ",
      " toys.\n\n**Status:** Closed until next ",
      " snack."
    ],
    blanks: ["number", "place", "object", "verb", "food", "adjective", "adjective", "verb", "verb", "body part", "object", "adjective", "adjective", "adjective"]
  },
  {
    title: "Y2K Preparedness Checklist",
    text: [
      "## Y2K Readiness Plan\n\n**Stockpile:**\n- ",
      " gallons of ",
      "\n- ",
      " batteries\n\n**Finances:** Withdraw ",
      " dollars in ",
      " bills from the bank.\n\n**Equipment:** Test the ",
      " generator and the ",
      " radio.\n\n**Maps:** Print maps because GPS may ",
      ".\n\n**Grandma:** Teach her to ",
      " without fear.\n\n**Supplies:** Store canned ",
      " and one ",
      " for morale.\n\n**Midnight rule:** Do not ",
      " near any ",
      " computer.\n\n**Worst case:** Build a ",
      " fort and assign ",
      " to guard duty."
    ],
    blanks: ["number", "type of liquid", "adjective", "number", "adjective", "adjective", "adjective", "verb", "verb", "food", "object", "verb", "adjective", "adjective", "name"]
  },
  {
    title: "IT Help Desk Update",
    text: [
      "## IT Help Desk Update\n\n@helpdesk heads-up:\n\n**Issue:** The ",
      " printer on floor ",
      " is ",
      " again.\n\n**On site:** ",
      " with a ",
      " toolkit while ",
      " clears the password-reset ",
      ".\n\n**Users affected:** Anyone trying to ",
      " or use the ",
      " conference room.\n\n**Workaround:** Route jobs to the ",
      " copier and ",
      " your laptop until further notice.\n\n**ETA:** ",
      " minutes unless the print spooler acts ",
      " again.\n\nPlease stop opening tickets titled \"The internet is ",
      ".\""
    ],
    blanks: ["adjective", "number", "adjective", "name", "adjective", "name", "object", "verb", "adjective", "adjective", "verb", "number", "adjective", "adjective"]
  },
  {
    title: "Server Room Incident",
    text: [
      "## Server Room Ticket\n\n**Ticket #",
      ":** Loud ",
      " noise reported in server room B.\n\n**Technician:** Arrived with a ",
      " flashlight and a clipboard.\n\n**Findings:**\n- A ",
      " cable connected to ",
      " power\n- An old ",
      " pizza box on the UPS\n- Sticky note: DO NOT ",
      "\n\n**Fix applied:** Labeled every ",
      " port and rebooted the ",
      " twice for luck.\n\n**Monitoring:** Now tracks ",
      " temperature and ",
      " humidity.\n\n**Reminder:** Stop storing ",
      " boxes next to the backup ",
      ".\n\nClosing as resolved-ish."
    ],
    blanks: ["number", "adjective", "adjective", "adjective", "adjective", "adjective", "food", "verb", "adjective", "object", "adjective", "adjective", "object"]
  },
  {
    title: "Baby Bear Nap Schedule",
    text: [
      "## Baby Bear Nap Protocol\n\n**Pre-nap:**\n- ",
      " story\n- ",
      " honey on toast\n\n**Music:** Soft ",
      " songs from the ",
      " collection.\n\n**Room:** Must be ",
      ", quiet, and free of ",
      " toys.\n\n**Duration:** Baby Bear will ",
      " for exactly ",
      " minutes unless a ",
      " butterfly appears.\n\n**Wake-up:** Stretching, yawning, and asking for another ",
      ".\n\n**If Baby joins:** Both may ",
      " until someone finds the ",
      " blanket.\n\n**Do not** schedule meetings during ",
      " hour."
    ],
    blanks: ["adjective", "adjective", "adjective", "adjective", "adjective", "plural noun", "verb", "number", "adjective", "object", "verb", "adjective", "adjective"]
  },
  {
    title: "Blockbuster Rental Night",
    text: [
      "## Blockbuster Night Checklist\n\n**Arrival:** Before ",
      " PM for best ",
      " selection.\n\n**Browse:**\n- ",
      " aisle first\n- ",
      " new releases near the ",
      " display\n\n**Rent:**\n- One ",
      " movie\n- One ",
      " comedy\n- Zero damaged ",
      " cases\n\n**Snacks:** ",
      " candy and a soda the size of a ",
      ".\n\n**At home:** ",
      " the tape, ignore tracking lines, and ",
      " during previews.\n\n**Return by:** ",
      " PM or pay a ",
      " late fee that feels ",
      ".\n\n**Bonus:** Argue about whether to rewind."
    ],
    blanks: ["number", "adjective", "adjective", "verb", "adjective", "adjective", "adjective", "plural noun", "adjective", "object", "verb", "verb", "number", "adjective", "adjective"]
  },
  {
    title: "MySpace Profile Update",
    text: [
      "## MySpace Profile\n\n**About me:** Currently ",
      " and obsessed with ",
      " bands.\n\n**Mood:** ",
      "\n\n**Music:** Anything ",
      " with loud ",
      ".\n\n**Heroes:** ",
      ", my ",
      " friends, and whoever invented ",
      ".\n\n**Interests:** ",
      ", glitter, and taking ",
      " photos in the bathroom mirror.\n\n**Top 8:** Updated — do not ",
      " if you are not on it.\n\n**New background:** ",
      " stars on a ",
      " background.\n\nComment if you want to join my ",
      " group!!! xoxo ",
      " :)"
    ],
    blanks: ["adjective", "adjective", "adjective", "adjective", "plural noun", "name", "adjective", "plural noun", "verb ending in 'ing'", "adjective", "verb", "adjective", "color", "adjective", "name"]
  }
];

function writeCategory(subdir, stories) {
  const dir = path.join(root, subdir);
  fs.mkdirSync(dir, { recursive: true });
  for (const story of stories) {
    const slug = story.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    fs.writeFileSync(path.join(dir, `${slug}.json`), JSON.stringify(story, null, 2) + '\n');
    console.log(`  ${subdir}/${slug}.json (${story.blanks.length} blanks)`);
  }
}

console.log('Seeding madlib originals…');
writeCategory('generic', GENERIC);
writeCategory('themed', THEMED);
console.log('Done.');
