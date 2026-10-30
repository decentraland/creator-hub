export type SkillsUpdateStatus = {
  // The scene has its own copy of decentraland/sdk-skills (a skills-lock.json entry).
  installed: boolean;
  // An install (no copy yet) or update (behind decentraland/sdk-skills main) is due, and
  // GitHub can be reached to run it now.
  outdated: boolean;
};
