// Everything personal about the site lives here. Edit these values and
// redeploy to change what the site says.
export const site = {
  // Full name, shown in the header, the page title and link previews.
  name: "Harvey Sehmi",
  // Used in sentences like "Share a memory of Harvey".
  firstName: "Harvey",

  // Optional. Shown under the name, e.g. born: "1952", died: "2026"
  // (or full dates such as "3 March 1952"). Leave empty to hide.
  born: "",
  died: "",

  // A few words shown under the name. Each string is its own paragraph.
  tribute: [
    "A place for family and friends to share photos, stories and memories of Harvey.",
  ],

  // Optional photo for the top of the page, e.g. "/images/harvey.jpg" for a
  // file saved as public/images/harvey.jpg. Signed-in family admins can also
  // pick any shared photo as the main photo from the site itself, which
  // takes priority over this.
  portrait: "",

  // How dates are written on the site.
  locale: "en-GB",
  timeZone: "Europe/London",

  // When false, search engines are asked not to list the site, so only
  // people who have the link will find it.
  allowSearchEngines: false,
};

export function lifeDates(): string {
  if (site.born && site.died) return `${site.born} – ${site.died}`;
  return site.born || site.died;
}
