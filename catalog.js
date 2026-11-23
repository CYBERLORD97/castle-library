/* Bibliographic records, not copies of third-party download pages. */
const CATALOG_RECORDS = [
  ['nomad','Nomad Letters','Nick Sleep','investing','2026','original'],
  ['hamming','The Art of Doing Science and Engineering','Richard Hamming','engineering','1997','original'],
  ['dream','The Dream Machine','M. Mitchell Waldrop','history','2001','original'],
  ['wip','Working in Public','Nadia Eghbal','engineering','2020','original'],
  ['seneca','On the Shortness of Life','Seneca','philosophy','c. 49','original'],
  ['efficiency','The Origins of Efficiency','Brian Potter','engineering','','original'],
  ['soul','The Soul of a New Machine','Tracy Kidder','engineering','1981','original'],
  ['car','Where Is My Flying Car?','J. Storrs Hall','history','2018','original'],
  ['twisted','Twisted','Pooja Gupta','fiction','','ocean'],
  ['end-zone','The End Zone','R. J. Lovell','fiction','','ocean'],
  ['sweetheart','Secrets and Sweetheart','Dr. Fenny J','fiction','','ocean'],
  ['good-father','The Good Father','M. A. Hunter','fiction','','ocean'],
  ['sailor','The Sailor','Susan Stoker','fiction','','ocean'],
  ['under-desk','Under His Desk','Jace Wilder','fiction','','ocean'],
  ['wicked-lies','Throne of Wicked Lies','Makayla Marie','fiction','','ocean'],
  ['charlie','Poor Charlie’s Almanack','Charles T. Munger','investing','2005','original'],
  ['python','Introduction to Python Programming','Udayan Das, Aubrey Lawson, Chris Mayfield & Narges Norouzi et al.','engineering','2024','expanded'],
  ['persia','The Making of Prince of Persia','Jordan Mechner','history','','original']
].map(([id,title,author,cat,year,origin]) => ({id,title,author,cat,year,origin,access:'listed'}));

const GENRES = {
  mystery: ['sherlock','hound','sign-four','study-scarlet'],
  romance: ['pride','emma','sense','persuas','jane-eyre','wuthering','twisted','sweetheart','sailor','under-desk'],
  scifi: ['time-machine','war-worlds','worlds-invisible','island-moreau','lost-world','frankenstein','flatland','little-brother','news-nowhere','connecticut'],
  gothic: ['frankenstein','dracs','jekyll','dorian','poe','phantom','wuthering'],
  children: ['alice','oz','anne','secret-garden','black-beauty','wind-willows','railway','five-children','tom-sawyer','little-women','carol','folktales'],
  adventure: ['jekyll-island','monte-cristo','king-solomons','robinson','lost-world','huckleberry','lord-jim'],
  memoir: ['equiano','seacole','douglass','franklin','up-slavery','persia'],
};
