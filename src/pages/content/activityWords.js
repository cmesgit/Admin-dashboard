// How a recorded change is described in a sentence.
//
// Shared by the Studio home's "Recent changes" panel and the History screen so
// the same event never reads two different ways on two screens.
//
// The stored values are fine as data ("hidden", "faqitem") but this is a CMS
// whose whole premise is plain language, and "admin hidden a faq item" is not
// English.

export const ACTION_VERB = {
  created: "added",
  updated: "edited",
  published: "published",
  hidden: "hid",
  deleted: "deleted",
  restored: "restored",
};

// The model name is an implementation detail. `kind` is Django's
// content_type.model, so without this the feed says "a faqitem" and
// "a homecontentblock".
export const KIND_WORD = {
  faqitem: "answer",
  announcement: "notice",
  showcasecourse: "course card",
  homecontentblock: "page section",
  homelistitem: "listed row",
  homefloater: "badge",
  contenttag: "label",
  blogpost: "post",
  currentaffair: "current affair",
  contentimage: "picture",
};

// "a answer" reads as a bug to anyone who sees it. Only ever applied to the
// words above, so a crude vowel check is exactly right here.
export const article = (word) => (/^[aeiou]/i.test(word) ? "an" : "a");

/** "hid an answer", "published a page section". */
export const describeChange = (item) => {
  const verb = ACTION_VERB[item.action] || item.action;
  const word = KIND_WORD[item.kind] || (item.kind_label || "").toLowerCase();
  return word ? `${verb} ${article(word)} ${word}` : verb;
};
