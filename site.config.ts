// Everything personal about the site lives here. Edit these values and
// redeploy to change what the site says.
export const site = {
  // Full name, shown in the header, the page title and link previews.
  name: "Harvey Sehmi",
  // Used in sentences like "Share a memory of Harvey".
  firstName: "Harvey",

  // Optional. Shown under the name, e.g. born: "1952", died: "2026"
  // (or full dates such as "3 March 1952"). Leave empty to hide.
  born: "1975",
  died: "2026",

  // A few words shown under the name. Each string is its own paragraph.
  tribute: [
    "I couldn’t find a picture of Harvey where he wasn’t smiling. This is for your favourite photos, funny stories and times he made you laugh.",
  ],

  // The photo at the top of the page: a file in the public folder, so
  // public/images/harvey-pointing.jpg is "/images/harvey-pointing.jpg". It's
  // shown square, so keep him near the middle. To change it, add the new
  // photo under a new file name (resized copies of the old one are kept for
  // weeks). Leave empty to show his initials instead. A signed-in family
  // admin can also pick any shared photo as the main photo from the site
  // itself, which takes priority over this.
  portrait: "/images/harvey-pointing.jpg",

  // How dates are written on the site.
  locale: "en-GB",
  timeZone: "Europe/London",

  // When false, search engines are asked not to list the site, so only
  // people who have the link will find it.
  allowSearchEngines: false,
};

// The choices for "How you knew Harvey" on the share form. Family titles are
// the ones his children use (so Mamaji is his wife's brother), and the text
// after each title is a hint shown only in the list. Only the title appears
// on the site. Edit, reorder or add to these freely; the form only accepts
// what's listed here.
type Relationship = string | [title: string, hint: string];

export const relationships: { group: string; options: Relationship[] }[] = [
  {
    group: "Close family",
    options: ["Wife", "Son", "Daughter", "Son-in-law", "Daughter-in-law", "Grandchild"],
  },
  {
    group: "His parents",
    options: [
      ["Dadaji", "his father"],
      ["Dadima", "his mother"],
    ],
  },
  {
    group: "His brothers and sisters",
    options: [
      ["Tayaji", "his older brother"],
      ["Taiji", "Tayaji's wife"],
      ["Chachaji", "his younger brother"],
      ["Chachiji", "Chachaji's wife"],
      ["Bhuaji", "his sister"],
      ["Phupharji", "Bhuaji's husband"],
    ],
  },
  {
    group: "His wife's family",
    options: [
      ["Nanaji", "his wife's father"],
      ["Nanima", "his wife's mother"],
      ["Mamaji", "his wife's brother"],
      ["Mamiji", "Mamaji's wife"],
      ["Masiji", "his wife's sister"],
      ["Masaji", "Masiji's husband"],
    ],
  },
  {
    group: "Wider family",
    options: ["Cousin", "Niece", "Nephew", "Other family"],
  },
  {
    group: "Friends and others",
    options: ["Friend", "Childhood friend", "Family friend", "Colleague", "Neighbour", "Other"],
  },
];

export function relationshipTitle(option: Relationship): string {
  return typeof option === "string" ? option : option[0];
}

export function isListedRelationship(title: string): boolean {
  return relationships.some((group) => group.options.some((option) => relationshipTitle(option) === title));
}

export function lifeDates(): string {
  if (site.born && site.died) return `${site.born} – ${site.died}`;
  return site.born || site.died;
}
