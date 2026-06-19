#!/usr/bin/env node
/**
 * One-off: write collection, format, tags into each madlib-originals JSON file.
 * Source of truth: Mad Lib Taxonomy Browser plan categorization.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  FORMAT_ORDER,
  TAG_ORDER,
  inferCollectionFromFolder,
  validateTaxonomy
} from '../src/lib/madlib-taxonomy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const originalsDir = path.join(root, 'src', 'data', 'madlib-originals');
const SUBDIRS = ['classics', 'legacy', 'generic', 'themed', 'official'];

/** @type {Record<string, { format: string, tags: string[] }>} */
const BY_TITLE = {
  // Classics — story
  'A Scary Halloween Story': { format: 'story', tags: ['spooky', 'kids'] },
  'A Spooky Campfire Story': { format: 'story', tags: ['spooky', 'kids'] },
  'All About Vampires': { format: 'story', tags: ['spooky', 'kids'] },
  'North Pole': { format: 'story', tags: ['seasonal', 'kids'] },
  'Snowstorm!': { format: 'story', tags: ['seasonal', 'kids'] },
  'Star Wars': { format: 'story', tags: ['media', 'kids'] },
  'The Fun Park': { format: 'story', tags: ['everyday', 'kids'] },
  'Three Little Pigs': { format: 'story', tags: ['kids'] },
  'Trip to the Park': { format: 'story', tags: ['everyday', 'kids'] },
  'Weird News': { format: 'story', tags: ['media', 'parody-bureaucratic'] },
  'Zombie Picnic': { format: 'story', tags: ['spooky', 'food'] },
  'Our Cafeteria': { format: 'story', tags: ['school', 'food', 'kids'] },
  // Classics — how-to
  'How To Cross a Piranha-Infested River': { format: 'how-to', tags: ['everyday', 'kids'] },
  'How to Date the Coolest Guy/Girl in School': { format: 'how-to', tags: ['school', 'kids'] },
  'Learning About History': { format: 'how-to', tags: ['school', 'kids'] },
  'Talk Like a Pirate': { format: 'how-to', tags: ['fantasy', 'kids'] },
  // Legacy
  'Letter from Camp': { format: 'letter', tags: ['school', 'kids'] },
  'Superhero Job Application': { format: 'form', tags: ['fantasy', 'workplace'] },
  // Generic — announcement
  'Airline Delay Announcement': { format: 'announcement', tags: ['travel', 'parody-bureaucratic'] },
  'Local News Traffic Report': { format: 'announcement', tags: ['media', 'civic'] },
  'Neighborhood Watch Bulletin': { format: 'announcement', tags: ['civic', 'everyday'] },
  'Product Recall Notice': { format: 'announcement', tags: ['civic', 'parody-bureaucratic'] },
  'Weather Forecast': { format: 'announcement', tags: ['media', 'everyday'] },
  'Yard Sale Sign': { format: 'announcement', tags: ['everyday'] },
  // Generic — checklist
  'Camping Supply Checklist': { format: 'checklist', tags: ['travel', 'everyday'] },
  'How to Host a Party': { format: 'checklist', tags: ['everyday'] },
  'New Hire IT Setup': { format: 'checklist', tags: ['workplace', 'tech'] },
  'Obituary': { format: 'announcement', tags: ['everyday', 'parody-bureaucratic'] },
  'Wedding Planner Checklist': { format: 'checklist', tags: ['everyday'] },
  // Generic — form
  'Lost and Found Report': { format: 'form', tags: ['everyday', 'civic'] },
  'School Permission Slip': { format: 'form', tags: ['school', 'kids'] },
  'Science Fair Abstract': { format: 'form', tags: ['school', 'kids'] },
  'UFO Sighting Report': { format: 'form', tags: ['sci-fi', 'parody-bureaucratic'] },
  // Generic — how-to
  'Escape Room Briefing': { format: 'how-to', tags: ['everyday', 'gaming'] },
  'Instruction Manual': { format: 'how-to', tags: ['everyday', 'tech'] },
  'Treasure Map Instructions': { format: 'how-to', tags: ['fantasy', 'travel'] },
  // Generic — incident-report
  "Doctor's Report": { format: 'incident-report', tags: ['workplace', 'parody-bureaucratic'] },
  'Help Desk Ticket': { format: 'incident-report', tags: ['tech', 'workplace'] },
  'VPN Support Call': { format: 'incident-report', tags: ['tech', 'workplace'] },
  'Zoo Keeper Daily Log': { format: 'incident-report', tags: ['workplace', 'pets'] },
  // Generic — legal
  'Boat Rental Waiver': { format: 'legal', tags: ['travel', 'parody-bureaucratic'] },
  'Parking Ticket Appeal': { format: 'legal', tags: ['civic', 'parody-bureaucratic'] },
  'Product Warning Label': { format: 'legal', tags: ['everyday', 'parody-bureaucratic'] },
  'Roommate Agreement': { format: 'legal', tags: ['everyday', 'parody-bureaucratic'] },
  // Generic — letter
  'Apology Letter': { format: 'letter', tags: ['everyday'] },
  'Birthday Party Invitation': { format: 'announcement', tags: ['kids', 'everyday'] },
  'Fortune Cookie Factory Memo': { format: 'letter', tags: ['food', 'workplace'] },
  'Gym Membership Cancellation': { format: 'letter', tags: ['everyday'] },
  'Hotel Concierge Recommendation': { format: 'letter', tags: ['travel'] },
  'Library Overdue Notice': { format: 'letter', tags: ['civic'] },
  'Office Fridge Warning': { format: 'letter', tags: ['workplace', 'food'] },
  'Restaurant Complaint': { format: 'letter', tags: ['food'] },
  'Substitute Teacher Note': { format: 'letter', tags: ['school'] },
  // Generic — listing
  'Apartment Listing': { format: 'listing', tags: ['everyday'] },
  'Dating App Profile': { format: 'listing', tags: ['everyday', 'media'] },
  'Help Wanted Ad': { format: 'listing', tags: ['workplace'] },
  'Horoscope': { format: 'listing', tags: ['media', 'everyday'] },
  'Travel Brochure': { format: 'listing', tags: ['travel'] },
  // Generic — log
  'Community Garden Minutes': { format: 'log', tags: ['civic', 'everyday'] },
  'Museum Gift Shop Receipt': { format: 'log', tags: ['travel', 'everyday'] },
  'Quiz Show': { format: 'log', tags: ['media'] },
  // Generic — review
  'Food Critic Tasting Notes': { format: 'review', tags: ['food'] },
  'Movie Review': { format: 'review', tags: ['media'] },
  'Recipe Blog Intro': { format: 'review', tags: ['food', 'media'] },
  // Generic — speech
  'Castle Tour Script': { format: 'speech', tags: ['travel', 'fantasy'] },
  'City Council Public Comment': { format: 'speech', tags: ['civic'] },
  'Courtroom Testimony': { format: 'speech', tags: ['civic', 'parody-bureaucratic'] },
  'Museum Audio Tour': { format: 'speech', tags: ['travel', 'media'] },
  'Wedding Toast Gone Wrong': { format: 'speech', tags: ['everyday'] },
  // Themed — checklist
  'Blockbuster Rental Night': { format: 'checklist', tags: ['retro-web'] },
  'LAN Party Snack Plan': { format: 'checklist', tags: ['gaming', 'retro-web'] },
  'Y2K Preparedness Checklist': { format: 'checklist', tags: ['retro-web', 'tech'] },
  'Baby Bear Nap Schedule': { format: 'checklist', tags: ['pets', 'kids'] },
  // Themed — form
  'Dragon Adoption Application': { format: 'form', tags: ['fantasy', 'pets'] },
  'Time Traveler Customs Form': { format: 'form', tags: ['sci-fi', 'parody-bureaucratic'] },
  'Wizard School Detention Slip': { format: 'form', tags: ['fantasy', 'school'] },
  'Pet Sitter Instructions': { format: 'form', tags: ['pets', 'everyday'] },
  // Themed — incident-report
  'IT Help Desk Update': { format: 'incident-report', tags: ['tech', 'workplace'] },
  'IT Incident Report': { format: 'incident-report', tags: ['tech', 'workplace'] },
  'Mall Security Incident Report': { format: 'incident-report', tags: ['workplace', 'parody-bureaucratic'] },
  "Matilda's Walk Report": { format: 'incident-report', tags: ['pets', 'everyday'] },
  'Printer Court Transcript': { format: 'incident-report', tags: ['tech', 'workplace', 'parody-bureaucratic'] },
  'Secret Agent Expense Report': { format: 'incident-report', tags: ['fantasy', 'workplace'] },
  'Server Room Incident': { format: 'incident-report', tags: ['tech', 'workplace'] },
  'Smart Fridge Status Update': { format: 'incident-report', tags: ['tech', 'everyday'] },
  "Zebby's Incident Report": { format: 'incident-report', tags: ['pets', 'everyday'] },
  // Themed — letter
  'Alien Exchange Student Letter': { format: 'letter', tags: ['sci-fi', 'school'] },
  'Streaming Algorithm Apology': { format: 'letter', tags: ['tech', 'media'] },
  "Violet's Demand List": { format: 'letter', tags: ['pets', 'everyday'] },
  // Themed — listing
  'AIM Away Message': { format: 'listing', tags: ['retro-web', 'media'] },
  'MySpace Profile Update': { format: 'listing', tags: ['retro-web', 'media'] },
  // Themed — legal
  'Haunted House Safety Briefing': { format: 'legal', tags: ['spooky', 'parody-bureaucratic'] },
  'Supervillain HOA Complaint': { format: 'legal', tags: ['fantasy', 'everyday', 'parody-bureaucratic'] },
  // Themed — log
  'D&D Session Recap': { format: 'log', tags: ['gaming', 'fantasy'] },
  'Fantasy Sports Draft Recap': { format: 'log', tags: ['sports', 'media'] },
  'Group Chat Pinned Rules': { format: 'log', tags: ['media', 'tech', 'everyday'] },
  'Home Renovation Reveal': { format: 'log', tags: ['everyday', 'media'] },
  'Space Mission Log': { format: 'log', tags: ['sci-fi'] },
  'True Crime Podcast Teaser': { format: 'log', tags: ['media', 'spooky'] },
  // Themed — announcement
  'Food Truck Opening Post': { format: 'announcement', tags: ['food', 'everyday'] },
  'Medieval Tournament Announcement': { format: 'announcement', tags: ['fantasy', 'sports'] },
  // Themed — review
  'Pirate Ship Performance Review': { format: 'review', tags: ['fantasy', 'workplace'] },
  'Robot Talent Show Scorecard': { format: 'review', tags: ['sci-fi', 'media'] },
  // Themed — speech
  'Influencer Unboxing Script': { format: 'speech', tags: ['media', 'tech'] },
  'Dot-Com Startup Pitch': { format: 'speech', tags: ['retro-web', 'workplace'] },
  // Themed — story / how-to
  'Baby and Baby Bear Bedtime': { format: 'story', tags: ['pets', 'kids'] },
  'Dial-Up Internet Guide': { format: 'how-to', tags: ['retro-web', 'tech'] }
};

function main() {
  let updated = 0;
  const missing = [];
  for (const sub of SUBDIRS) {
    const dir = path.join(originalsDir, sub);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
      const full = path.join(dir, file);
      const data = JSON.parse(fs.readFileSync(full, 'utf8'));
      const title = data.title || file.replace(/\.json$/, '').replace(/-/g, ' ');
      const spec = BY_TITLE[title];
      if (!spec) {
        missing.push(title);
        continue;
      }
      const collection = inferCollectionFromFolder(sub);
      validateTaxonomy(title, { collection, format: spec.format, tags: spec.tags });
      data.collection = collection;
      data.format = spec.format;
      data.tags = spec.tags;
      if (!data.category) data.category = sub;
      fs.writeFileSync(full, JSON.stringify(data, null, 2) + '\n');
      updated++;
    }
  }
  console.log(`Tagged ${updated} templates`);
  if (missing.length) {
    console.error('Missing taxonomy for:', missing);
    process.exit(1);
  }
  console.log(`Formats: ${FORMAT_ORDER.length}, Tags: ${TAG_ORDER.length}`);
}

main();
