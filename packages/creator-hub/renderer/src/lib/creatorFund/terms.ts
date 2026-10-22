/**
 * Creator Fund Program Terms — MOCK copy for the POC, not legal text.
 *
 * Modelled on the structure of creator engagement-program terms elsewhere
 * (eligibility, enrollment, payments, prohibited conduct, termination), with
 * the numbers the fund actually runs on (`creator-fund/knowledge/definitions.md`).
 * English only on purpose: the reviewed text will replace it wholesale.
 */

export const TERMS_TITLE = 'Decentraland Creator Fund Program Terms (Beta)';
export const TERMS_UPDATED = 'Last updated: October 22, 2026 · Version 2026-10-beta';

export type TermsSection = { heading: string; paragraphs: string[] };

export const TERMS_SECTIONS: TermsSection[] = [
  {
    heading: '1. About the Program',
    paragraphs: [
      'The Decentraland Creator Fund (the "Program") rewards creators whose scenes and Worlds bring players to Decentraland and keep them coming back. These Program Terms are an agreement between you and the Decentraland Foundation (the "Foundation") and supplement the Decentraland Terms of Use and Content Policy, which continue to apply.',
      'The Program is in beta. During the beta, the metrics it pays on and their weights do not change.',
    ],
  },
  {
    heading: '2. Eligibility',
    paragraphs: [
      'To join, you must hold a Decentraland account in good standing, be of legal age to enter into this agreement where you live, and not be an employee or contractor of the Foundation or Regenesis Labs.',
      'Only scenes you own or operate can take part. A scene can take part unless it is Foundation or Regenesis Labs content, sits on a Genesis City road, is disabled in the Places catalogue, or is a World that needs a password, an invite list or an NFT to enter. Player counts never prevent a scene from taking part.',
    ],
  },
  {
    heading: '3. Enrollment',
    paragraphs: [
      'When you join, every eligible scene you own or operate is enrolled. Scenes you publish later are enrolled automatically if they are eligible. You can leave the Program at any time; you keep payouts for cycles that closed before you left.',
    ],
  },
  {
    heading: '4. How Payouts Are Calculated',
    paragraphs: [
      'The Program runs in half-month cycles (the 1st to the 15th, and the 16th to the end of the month, UTC), each with a fixed pool. A cycle closes three days after its last day so that returning players can be counted.',
      'Payouts are based on three metrics measured over qualifying players only: new players, credited to the scene they played most on their first day; AFK-free playtime; and new players who return within one to three days. A qualifying player spends more than five AFK-free minutes in scenes during the cycle, plays on a production realm, and is not classified as automated.',
      'A scene is paid for a cycle only if it has at least ten qualifying players in that cycle. Amounts under five US dollars are not paid. The exact formula is not disclosed; the component metrics are shown to you in Creator Hub.',
    ],
  },
  {
    heading: '5. Payout Wallet and Payments',
    paragraphs: [
      'You must set and lock a payout wallet in Creator Hub. Each cycle is paid to the wallet that is locked when the cycle closes. You are responsible for the wallet address you provide; payments sent to it are final.',
      'Payments are made within thirty days of a cycle closing. You are responsible for any taxes on amounts you receive, and the Foundation may ask for tax or identity information before paying you.',
    ],
  },
  {
    heading: '6. Prohibited Conduct',
    paragraphs: [
      'You may not inflate your metrics. This includes bots, scripts or automated clients; paying or rewarding players for visits; playing your own scenes from several accounts; and directing players from paid advertising and counting them as new players.',
      'The Foundation runs automated and manual review on every cycle. Players found to be automated are removed from the calculation, and the Foundation may withhold or reclaim payouts that result from prohibited conduct.',
    ],
  },
  {
    heading: '7. Content',
    paragraphs: [
      'Your scenes must comply with the Decentraland Content Policy. You retain all rights in your content. Joining the Program does not grant the Foundation any license beyond what the Terms of Use already provide.',
    ],
  },
  {
    heading: '8. Data',
    paragraphs: [
      'To run the Program, the Foundation processes gameplay data about the players in your scenes. You will see aggregated metrics only and never data about individual players. The Foundation may publish a ranking of the top twenty creators and their payouts for each cycle.',
    ],
  },
  {
    heading: '9. Changes, Suspension and Termination',
    paragraphs: [
      'The Foundation may change these Program Terms with notice in Creator Hub; changes apply from the next cycle. The Foundation may suspend or end your participation for a breach of these Program Terms, and may end the Program with thirty days’ notice.',
    ],
  },
  {
    heading: '10. Disclaimers',
    paragraphs: [
      'The Program is provided as is. Payouts are not wages, are not guaranteed, and do not create an employment, partnership or agency relationship. Nothing in the Program is an offer of securities or investment.',
      'By selecting "I have read and accept the Creator Fund Program Terms" and joining, you agree to these Program Terms.',
    ],
  },
];
