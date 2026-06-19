#!/usr/bin/env node
/**
 * Write official Penguin Mad Libs templates (from authorized PDFs).
 * Sources: MadLibsDownload.pdf (Brightly sampler), Kickstarter-Mad-Libs.pdf (2020).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateTaxonomy } from '../src/lib/madlib-taxonomy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'src', 'data', 'madlib-originals', 'official');

/** @type {Array<{ slug: string, title: string, format: string, tags: string[], text: string }>} */
const OFFICIAL_STORIES = [
  {
    slug: 'best-sellers-for-kids',
    title: 'Best Sellers for Kids',
    format: 'review',
    tags: ['kids', 'media'],
    text: `All children have {adjective} memories of the books their mothers and {noun} read to them. Here are some of the all-time {adjective} favorites:

• The Giving {noun} is a touching story about a friendship between a/an {noun} and a tree. Throughout the boy's life, the {noun} gives and gives. Kids between the ages of {number} and {number} love this story.

• Goodnight Moon is a/an {adjective} book that captures a child's nightly ritual of saying good night to everything in his {noun}. It's great for {plural noun} ages two through six.

• Written in rhyme, Green Eggs and {food} made Dr. Seuss one of the best-loved children's {plural noun} of all time. While many {plural noun} have a moral or a/an {noun}, the lesson in this classic is: If you've never tried something, you can't say you don't like it. A perfect read for all {adjective} kindergartners.`
  },
  {
    slug: 'the-great-american-pastime',
    title: 'The Great American Pastime',
    format: 'story',
    tags: ['sports', 'food'],
    text: `One of the things most {adjective} sports fans look forward to at American baseball {plural noun} is eating a/an {adjective} hot dog. There is nothing more traditional than watching a/an {adjective} ball game and eating a hot {noun} drenched in mustard, relish, and {noun}. Some {noun}-parks even have their own {adjective} specialties, such as the Dodger {noun} in Los Angeles. (It's an oversize steamed or grilled {plural noun}.) Hot {plural noun} were created at the end of the nineteenth century when a sausage-maker saw his {noun} customers wearing gloves on their {body part} because the steaming sausages were too {adjective} to handle. He put them in a/an {adjective} roll, and that was the beginning of the {adjective} dog in a bun. The rest, as they say, is {noun}!`
  },
  {
    slug: 'my-bff',
    title: 'My BFF',
    format: 'story',
    tags: ['retro-web', 'kids'],
    text: `Thanks to social networking {plural noun} like My-{noun} and {noun}-book, everyone now has hundreds of {plural noun} friends. But most people really have only one best {noun}. A BFF is someone you tell your deepest, most {adjective} secrets to, knowing they won't tell a single {noun}. You and your best {noun} can pass {noun} in class and share a hot fudge {noun} after school. And if your {noun} friend wants some advice on the latest {noun} in their life, you'll give them the {adjective} truth. And finally, if you ever need a/an {adjective} to cry on, your BFF will be there with a box of {plural noun} and a/an {noun} of hot cocoa. Who could {verb} for anything more?`
  },
  {
    slug: 'my-high-tech-world',
    title: 'My High-Tech World',
    format: 'story',
    tags: ['tech', 'kids'],
    text: `Wow! I bought a new smart-{noun} today. It not only makes {noun} calls—it also forecasts the {noun} so I know whether to wear a/an {noun} or carry a/an {noun} in case it rains cats and {plural noun}. It can also read and send e-{noun} and even record a TV {noun}. And I will never get lost again because I now have a global {noun} system that gets me from point A to {noun} B in no time. I also received a/an {noun}-reader for my birthday. Imagine not only being able to download any book in just {number} seconds but view hundreds of magazines and {plural noun} from all over the {noun}. How did we ever get through each {noun} day before these {adjective} inventions?`
  },
  {
    slug: 'social-networking',
    title: 'Social Networking',
    format: 'story',
    tags: ['retro-web', 'tech'],
    text: `Do you remember radio, handwritten letters, and landline {plural noun}—all the technology used by your parents to communicate with their {plural noun}? These technologies are now as old as {noun}. They've been replaced by Twitter and {noun}-book. Twitter is a great way to stay in touch with all your {body part} and share {plural noun} information about what is happening in your own {adjective}. Just remember to keep it to 140 characters. Facebook is a social {noun} service with more than five hundred million {verb ending in -ing}. You can create a/an {plural noun} profile, add other {adjective} as friends, and exchange {plural noun} messages. Face-{adjective} was founded by {noun} and a few of his {person} college classmates. Social networks are popular on the {adjective} Wide Web, where they have their own {noun} language, such as GTG (got to go), LOL (laughing out loud), or XOXO (hugs and {adjective}).`
  },
  {
    slug: 'video-games',
    title: 'Video Games',
    format: 'story',
    tags: ['gaming', 'kids'],
    text: `Although video {plural noun} have been around for over {number} years, they've become more and more {adjective} as developers create more sophisticated {plural noun}. Today's {plural noun} games are so complicated, they require really {adjective} attention at all times. They have you sitting on pins and {noun} throughout the entire game. Such {plural noun} as Final {noun} XIII, Grand Theft {noun}, and (the) {place} Noire cost more to develop than many {plural noun} movies produced by big Hollywood {plural noun}. If the technology in the video-gaming {noun} continues to advance, imagine what future electronic {plural noun} will be like. It's {adjective}-boggling.`
  },
  {
    slug: 'fourth-of-july-bloopers',
    title: 'Fourth of July Bloopers',
    format: 'story',
    tags: ['seasonal', 'kids'],
    text: `Our Fourth of July started out {adjective} enough. Aunt {person} and Uncle {person} were coming over to spend the day with my family. We had a really {adjective} barbecue set up in the backyard, with lots of {food} and {plural noun} right off the grill. The trouble started when my aunt and uncle arrived and we found out they had brought along the newest and most {adjective} member of their family: a/an {number}-pound pet pig named {person}! The pig looked {adjective} enough, and he even made a noise that sounded like "{silly word}!" when I petted him on his {body part}. But when we put him in the backyard to {verb}, everything got totally out of hand! The pig took one sniff of all the {adjective} food and started to {verb} around like crazy. He knocked over all the tables and {plural noun}, destroyed my kid sister's playhouse, and took a swim in the {food}. "That's it!" my father yelled. "Next time you bring a/an {animal} to a barbecue, we're going to cook him!"`
  },
  {
    slug: 'detention-survival-kit',
    title: 'Detention Survival Kit',
    format: 'checklist',
    tags: ['school', 'kids'],
    text: `My best {noun}, {person}, is a pro at serving detentions and suggests bringing the following items to make it through the hour:

• A/An {noun} phone—but don't use it for {verb ending in -ing}; instead, use it as a watch, a calculator, or a/an {noun}. And be sure to turn it to "{noun}" so it doesn't ring.

• An i-{noun} to listen to music. Cover up the {noun}-phones by wearing a hooded {body part}.

• Some tissues, in case you need to blow your {noun}

• Blank paper and something to {verb} with. Use these {body part} items to compose love songs to your crush, {person}, draw a comic strip featuring {person} as the underwear-wearing superhero Captain {noun}-pants, or even do something crazy, like your {adjective} homework

• A pair of {person}-glasses—you might as well look {person} while you're there!`
  },
  {
    slug: 'road-trip',
    title: 'Road Trip!',
    format: 'how-to',
    tags: ['travel', 'civic'],
    text: `Pack your bags! It's time to take a/an {adjective} road trip across the United States to visit some of the most {adjective} historical landmarks. First stop is Philadelphia, where you can visit Independence Hall to see where the Declaration of {plural noun} was signed. After that, check out the Liberty Bell. It's the most famous cracked {noun} in history, and a symbol of freedom across America. Then head on up to Boston, where you can check out the USS Constitution, the oldest {verb ending in -ing} naval vessel, and the {noun} Hill Monument. In New York, you can climb to the top of the {noun} of Liberty (or take a/an {vehicle} to check out the view from the harbor!). Now it's time to head west, where you can see famous landmarks like Mount {silly word}, which features carved statues of the {body part} of some of our most {adjective} presidents. Or check out {color}-stone, our first national park, which includes the famous geyser Old {adjective}! Just don't forget to pack a/an {noun}—you'll want to take pictures to remember your {adjective} trip by!`
  },
  {
    slug: 'castle-for-sale',
    title: 'Castle for Sale',
    format: 'listing',
    tags: ['fantasy', 'kids'],
    text: `Are you a king, queen, or {job} looking for that perfectly {adjective} new home? Then have we got a/an {adjective} place for you! King {person}'s {adjective} castle has just come on the market! Originally built in the {adjective} Ages, this lakefront wonder has towers that rise high above (the) {place} and a/an {adjective} view that will take your {body part} away. In each and every room of this 25,000 square-{body part} masterpiece, there are magnificent stained glass {plural noun} and splendid Gothic {noun}-burning fireplaces. There's also a chef's state-of-the-art, {adverb} modern {noun} for those who love to {verb}. For security and {adjective} privacy, there is also a moat filled with {plural noun} and a drawbridge to keep out unwanted {plural noun}. Take advantage of the collapse in the castle market and make a/an {adjective} offer on this treasure. The asking price is a ridiculously low {number} dollars.`
  },
  {
    slug: 'how-to-be-a-princess',
    title: 'How to Be a Princess',
    format: 'how-to',
    tags: ['fantasy', 'kids'],
    text: `It is difficult not to envy a young woman who has everything her {body part} desires. But history shows it isn't easy being a princess. You have to maintain {adjective} standards and abide by {adjective} rules. For example:

• A princess should always be kind to, and understanding of, her royal {plural noun}. A princess knows that a/an {adjective} smile is preferable to a/an {adjective} frown.

• A princess should be a patron of the arts, well-versed in classical {adjective}, and {adverb} familiar with {adjective} authors and their {noun} works.

• A princess should never make a/an {adjective} decision. She should always think before {verb ending in -ing}. And when she does speak, she should be articulate and, if possible, very {adjective}.

• And, of course, a princess must be prepared to marry a/an {adjective} prince and live {adverb} ever after.`
  },
  {
    slug: 'summer-movie-reviews',
    title: 'Summer Movie Reviews',
    format: 'review',
    tags: ['media', 'kids'],
    text: `It's summer, and you know what that means: {adjective} weather, icy-cold {noun}-sicles, and big blockbusters. Check out what's coming to a/an {noun} near you this summer!

• {noun} of the Caribbean: Captain {person} and his band of {adjective} scalawags take to the {adjective} seas in search of buried {plural noun}.

• The Big {noun} Ogre: A cranky ogre named {person}, his sidekick—a/an {animal} named {person}—and a/an {adjective} gang of fairy tale creatures go on a search and {verb} mission to rescue Princess {person} from a tower guarded by a fire-breathing {animal}.

• The Boy Wizard: A/An {adjective} boy discovers he possesses magical {noun} that he must use to defeat the evil wizard, Lord {person}.`
  },
  {
    slug: 'a-morning-person',
    title: 'A Morning Person',
    format: 'listing',
    tags: ['media', 'workplace'],
    text: `Are you cheery and {adjective} at the crack of dawn? Do you leap out of bed early in the morning, ready to greet the world with a dazzling {noun}? As a journalist, can you quickly switch gears from interviewing the ruler of (the) {place} to quizzing an expert on the effects of global {verb ending in -ing} on the planet to judging a beauty contest for {animal}? Then you could be the {adjective} morning show host we're looking for! The number one–ranked show Good Morning, {noun} is searching for a cohost to join the current host, {person}. The show combines {adjective}, hard news stories with lighter pieces such as cooking and {verb ending in -ing} segments, interviews with A-listers like {person} and {person}, and fashion tips such as one hundred stylish ways to wear a feathered {noun}. Salary is {number} dollars a year plus a generous allowance for clothing and {plural noun}. Are you qualified? Then {verb} today for an application!`
  },
  {
    slug: 'pinktastic',
    title: 'Pinktastic',
    format: 'story',
    tags: ['kids', 'everyday'],
    text: `My absolute favorite {noun} in the whole, {adjective} world is pink. Everything I wear is pink, from my head down to my {body part}. I eat, sleep, and {verb} pink! I redecorated my room with pink wallpaper, pink carpeting, and pink {plural noun}. I cover all my school {plural noun} in pink paper and use only pink {plural noun} to write my homework. I even got permission from the {adjective} principal to paint my locker pink! I can't wait until I turn {number} years old and get my {adjective} license because I've been saving up money to buy a hot pink convertible {noun}. It will be so {adjective}. Maybe one day I'll have a/an {adjective} pink house, too! Then there will be no doubt in anyone's {noun} that pink is my favorite color in the whole, wide {noun}!`
  },
  {
    slug: 'the-blank-page',
    title: 'The Blank Page',
    format: 'how-to',
    tags: ['media', 'workplace'],
    text: `Have an idea for the next great American {noun}, but don't know where to {verb}? Well, here's some advice from one {job} to another. First, remember that even {adjective} writers like {person} had to start writing at some point. So, don't get down in the {plural noun} just because they already have {number} books with their name on them. Then, remind yourself that {verb ending in -ing} is a process . . . A/an {adjective} process. Some authors take more than {number} months just to research and write one short {noun}! You'll want to get your {plural noun} on paper as fast as you can. Then it's time to revise, and {verb ending in -ing} again. And if you get stuck, try taking a walk around the {plural noun} to get your creative {noun} flowing. Sometimes the best writing happens when you're not even {verb ending in -ing} at your computer. And finally, find a supportive {food} to read your work. Nothing is more motivating than having a friend nearby to {verb} you during the writing process.`
  },
  {
    slug: 'the-story-of-you',
    title: 'The Story of You',
    format: 'how-to',
    tags: ['media', 'everyday'],
    text: `Everyone has a unique {noun} inside of them that's just {verb ending in -ing} to come out! So, what are you standing on the {plural noun} for? It's time to step into that {place} and share your experiences with (the) {plural noun}! Once you do, you'll be surprised at how many {job} can't wait to hear more. Readers love {adjective} stories that are told from the PO-{noun} of the person who lived through them. You know what they say, {plural noun} are stranger than fiction. Of course, you'll have to be as brave as a/an {adjective} in shining armor to share your innermost {body part} and feelings. But there are great rewards for writers who are truly {adjective}. After all, it takes a lot of {body part} to air out your {plural noun} laundry in hopes of inspiring others to overcome their own {plural noun}. But in the {noun}, it's {adverb} worth it!`
  },
  {
    slug: 'writing-for-change',
    title: 'Writing for Change',
    format: 'letter',
    tags: ['civic', 'everyday'],
    text: `Dear {job},

I'm writing to you because I'm passionate about {plural noun}. I think it's important that everyday people, like me, speak up about all the problems that need {verb ending in -ing} in our {place} today. I can't just watch TV in my {place} like a couch {food} anymore. I want to {verb} up for what I believe in! For example, there are endangered {animal} living in our rivers and {plural noun} that need protecting! We need more environmentally {adjective} products in our supermarkets, to help {verb} the environment. And we need to make sure each man, woman, and {noun} has the right to life, liberty, and the pursuit of {noun}. {silly word}! It feels so good to {verb} all this down in a letter. I want to thank you for your {noun} and I look forward to your response.

{person},
{person}`
  },
  {
    slug: 'call-for-submissions',
    title: 'Call for Submissions',
    format: 'form',
    tags: ['media', 'workplace'],
    text: `Seeking: Journal entries from talented {plural noun} with an interest in writing about the performing {plural noun} for inclusion in a/an {noun}-winning anthology. Entries must be {number} words or less and should {verb} your passion for this {adjective} topic. Interest in site-specific {plural noun} held in a/an {place} is a plus.

To Apply: Please up-{verb} your application, cover {noun}, resume, and a sample of {adjective} work to our website. We encourage applicants who are able to {verb} well with others in a highly diverse and collaborative {noun}.

Thank you, {adverb}, for your submission.`
  }
];

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  for (const story of OFFICIAL_STORIES) {
    validateTaxonomy(story.title, {
      collection: 'official',
      format: story.format,
      tags: story.tags
    }, { requireAll: true });

    const text = `## ${story.title}\n\n${story.text}`;
    const entry = {
      title: story.title,
      category: 'official',
      collection: 'official',
      format: story.format,
      tags: story.tags,
      text
    };
    fs.writeFileSync(
      path.join(outDir, `${story.slug}.json`),
      JSON.stringify(entry, null, 2) + '\n'
    );
  }
  console.log(`Wrote ${OFFICIAL_STORIES.length} official templates to ${outDir}`);
}

main();
