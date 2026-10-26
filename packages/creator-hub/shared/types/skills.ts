export type SkillsUpdateStatus = {
  // The scene has its own copy of decentraland/sdk-skills (a skills-lock.json entry).
  installed: boolean;
  // decentraland/sdk-skills main has commits that copy doesn't.
  outdated: boolean;
};
