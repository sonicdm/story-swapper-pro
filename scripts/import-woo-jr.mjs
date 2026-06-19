#!/usr/bin/env node
/** Write WooJr.com Mad Lib templates (from mad libs.pdf scan). */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateTaxonomy } from '../src/lib/madlib-taxonomy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'src', 'data', 'madlib-originals', 'woo-jr');

/** @type {Array<{ slug: string, title: string, format: string, tags: string[], text: string }>} */
const STORIES = [
  {
    slug: 'bb-8-and-r2-d2',
    title: 'BB-8 and R2-D2',
    format: 'story',
    tags: ['media', 'kids', 'sci-fi'],
    text: `R2D2 is a {color} and {color} {adjective} droid. R2 units were built to {verb} humans and can {verb} and even {verb}. R2D2 first served Queen {person} and went on to {verb} Jedi {noun} Luke {noun} walker.

BB-8 is a BB series astromech {noun} with a {noun}-shaped head like R2D2 and a body shaped like a {noun}. BB-8 is a {adjective} droid to Commander {person} Dameron. BB-8 and R2D2 {past-tense verb} together to help {verb} the First Order.`
  },
  {
    slug: 'the-haunted-house-on-my-street',
    title: 'The Haunted House on My Street',
    format: 'story',
    tags: ['spooky', 'kids', 'seasonal'],
    text: `There is a house on my {noun} that is {adverb} haunted. It's the old {person} place that's been {adjective} for {number} years. I can tell the house is {adjective} because there are {plural noun} and {adjective} {plural noun} outside, and it smells like old {food}. I heard that a kid named {person} {past-tense verb} inside and never {past-tense verb} back out. My friends and I are {emotion} to {verb} past the house because it's so {adjective}.`
  },
  {
    slug: 'is-there-a-monster-in-my-room',
    title: 'Is There a Monster in My Room?',
    format: 'story',
    tags: ['spooky', 'kids'],
    text: `Every night before I {verb} to sleep, I swear I can {verb} noises in my closet. It sounds like a {adjective} {noun} is {verb ending in -ing} in there and it's so {adjective}! When I call my mom and {person}, they never {verb} anything. So I {verb} off the lights and try to {verb}. That's when the {plural noun} start under my {object}. Is it a monster, or something else, like a {noun} or maybe even a {noun}?`
  },
  {
    slug: 'my-best-friend-is-a-ghost',
    title: 'My Best Friend Is a Ghost',
    format: 'story',
    tags: ['spooky', 'kids', 'school'],
    text: `This might sound {adjective}, but my {adjective} friend is a ghost. We met in {number} grade at school while they were {verb ending in -ing} the {place}. Their name is {person} and they were {number} years old when they died. No one can {verb} my friend but me. They have {color} hair and are {adverb} {adjective}, and their clothes are {adjective}. Having an invisible friend is {adjective}, but they always win at {verb} and seek.`
  },
  {
    slug: 'family-beach-road-trip',
    title: 'Family Beach Road Trip',
    format: 'story',
    tags: ['travel', 'kids', 'seasonal'],
    text: `My family is taking a trip to {color} Beach, {number} hours away. We are riding in a {vehicle} with my {person} and {person}. My parents packed a cooler with {food} sandwiches, {food}, and {food}. They always {verb} us to wear {noun} and a {noun} so we don't get sunburned. During the drive, we will {verb} games like {noun} and "Count the {plural noun}." I can't wait to get there so I can go {verb ending in -ing} in the ocean and {verb} along the beach and collect {plural noun} I find in the sand.`
  },
  {
    slug: 'what-i-did-for-summer-vacation',
    title: 'What I Did for Summer Vacation',
    format: 'story',
    tags: ['travel', 'kids', 'seasonal'],
    text: `Last summer, my family and I went to a {place} on vacation. We {past-tense verb} in a {vehicle}, and it took {number} days to get there. I took lots of photos of the {plural noun} there, and saw wild {animal} {verb ending in -ing} in the {noun}. We rode a {vehicle} through a {adjective} {place} and there were {animal} and {animal} {verb ending in -ing} all around us! At night, we went to a {noun} and heard {adjective} {plural noun} while we ate {adjective} {food}. I can't wait to share my {adjective} photos of {plural noun} and {plural noun} with my friends!`
  },
  {
    slug: 'the-pyramids-of-ancient-egypt',
    title: 'The Pyramids of Ancient Egypt',
    format: 'story',
    tags: ['school', 'kids'],
    text: `Pyramids are {adjective} tombs where Egyptians {past-tense verb} their kings and {adjective} families. Some of them are {number} years old, each taking many {plural noun} to build. Each pyramid had {plural noun} inside and were decorated with {plural noun} and {adjective} {plural noun}. Some royal {plural noun} arranged to have {plural noun} and {past-tense verb} with them when they died. Today, archaeologists and other {plural noun} continue to {verb} these ancient {plural noun} to {verb} about how people {past-tense verb} in the past.`
  },
  {
    slug: 'the-moon-landing',
    title: 'The Moon Landing',
    format: 'story',
    tags: ['school', 'kids', 'sci-fi'],
    text: `On July {number} 1969, two American {plural noun} were the first to {verb} on the moon. This {adjective} trip took {number} days to reach the moon from {place}. As {person} Armstrong and {person} Aldrin {past-tense verb} onto the {noun} of the moon, Armstrong {past-tense verb} the famous words, "That's {number} {adjective} step for a man, one {adjective} leap for mankind." Soon after, Aldrin {past-tense verb} onto the moon and together, they {past-tense verb} a U.S. {noun} on the surface. They {past-tense verb} {plural noun} from the moon's surface to {verb} back to Earth and {adverb} returned home {number} days later.`
  },
  {
    slug: 'pretty-princess',
    title: 'Pretty Princess',
    format: 'story',
    tags: ['fantasy', 'kids', 'media'],
    text: `A new and {adjective} fairy princess movie is coming out soon! It will be about Snow {person} and the {number} dwarfs. Snow {person} is a princess whose beauty threatens her {person}, the queen. Snow {person} is forced to flee from {place} and hides in nearby {place}. There, she discovers the dwarfs {verb ending in -ing} in their {plural noun}. But the queen finds her and casts a {adjective} spell on her. The dwarfs take care of her until the {adjective} {person} comes to rescue her, and they all live {adverb} ever after!`
  },
  {
    slug: 'tall-tale-mad-lib',
    title: 'Tall Tale Mad Lib',
    format: 'story',
    tags: ['kids', 'everyday'],
    text: `Once upon a time there was a {noun} named {person} who was so {adjective} that he could {verb} the {noun}. His favorite thing to do was {verb} with the {noun}. He had a {animal} named {person} who was so {adjective} that it could {noun} in {noun}. They liked to play together, especially {noun}. Whenever they played {noun}, the neighborhood {job} would hide under their {object}. One day while they were playing, they found a {animal} who was crying. Its {body part} was stuck in a {noun} and the {animal} couldn't get loose. So they thought about what they could do to help. Finally, {animal} had an idea! "Let's {verb} some {noun} onto its paw."`
  },
  {
    slug: 'paul-bunyan-mad-lib',
    title: 'Paul Bunyan Mad Lib',
    format: 'story',
    tags: ['kids', 'everyday'],
    text: `Paul Bunyan was a powerful giant, {number} feet tall. He was famous throughout the lumbering districts for his great {adjective} strength. So great was his lung capacity that he called his {plural noun} to dinner by blowing through a {adjective} tree. When he spoke {noun} sometimes fell from trees.

When he had doughnuts for breakfast, they were carried from the {place} by {number} {noun} on poles which they carried on their {body part}.

Bunyan was assisted in his lumbering by a huge blue {animal} named Babe. This {adjective} {animal} had the strength of nine {plural noun} and it weighed {number} thousand pounds. Its head was so big, it measured seven {plural noun} between the eyes. Its horns were of {adjective} and {adjective} Paul tied a line to their tips and hung {noun} on it to dry. The original color of the animal was pure {color}.

One {noun} it snowed {color} snow for {number} days and the ox lying down in it all {noun} was dyed {color}. Paul and Babe {verb} a {adjective} house up a hill. In the woods around Paul's camp were {adjective} animals. Some were very wild and {adjective} and others harmless. There was a {animal} which laid square eggs so that they would not roll {noun} the hill.`
  }
];

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  for (const story of STORIES) {
    validateTaxonomy(story.title, {
      collection: 'woo-jr',
      format: story.format,
      tags: story.tags
    }, { requireAll: true });

    const entry = {
      title: story.title,
      category: 'woo-jr',
      collection: 'woo-jr',
      format: story.format,
      tags: story.tags,
      text: `## ${story.title}\n\n${story.text}`
    };
    fs.writeFileSync(
      path.join(outDir, `${story.slug}.json`),
      JSON.stringify(entry, null, 2) + '\n'
    );
  }
  console.log(`Wrote ${STORIES.length} WooJr templates to ${outDir}`);
}

main();
