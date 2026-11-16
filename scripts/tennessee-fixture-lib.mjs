/** Independent, deterministic synthetic votes. This is NOT an election model or observed data. */
export const CANDIDATES = Object.freeze([
  { id: 'aster', name: 'Aster Rowan (fictional)', color: '#7544A6', ballotOrder: 0 },
  { id: 'briar', name: 'Briar Solis (fictional)', color: '#008C90', ballotOrder: 1 },
  { id: 'cedar', name: 'Cedar Vale (fictional)', color: '#B47F15', ballotOrder: 2 },
]);

export function expectedTennesseeIds() {
  return Array.from({ length: 95 }, (_, index) => `47${String(2 * index + 1).padStart(3, '0')}`);
}

export function generateTennesseeFixture(counties) {
  const expected = expectedTennesseeIds();
  if (!Array.isArray(counties) || counties.length !== expected.length) {
    throw new Error('Source counties must contain exactly 95 entries');
  }
  const units = counties.map((county, index) => {
    if (county.geoId !== expected[index] || typeof county.name !== 'string' || !county.name.endsWith(' County')) {
      throw new Error(`Incorrect or unsorted official Tennessee county reference at index ${index}`);
    }
    const n = Number(county.geoId.slice(2));
    const eligibleVoters = 4500 + ((n * 17431 + 9239) % 107000);
    const ballots = Math.floor(eligibleVoters * (0.42 + (n % 13) / 100));
    const otherBallots = Math.floor(ballots / 97);
    const candidateBallots = ballots - otherBallots;
    const weights = [31 + (n * 7) % 29, 25 + (n * 11) % 29, 28 + (n * 13) % 29];
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const aster = Math.floor(candidateBallots * weights[0] / totalWeight);
    const briar = Math.floor(candidateBallots * weights[1] / totalWeight);
    const cedar = candidateBallots - aster - briar;
    return { geoId: county.geoId, stateId: '47', eligibleVoters, votes: { aster, briar, cedar }, otherBallots };
  });
  return {
    election: {
      id: 'tn-synthetic-v1',
      title: 'Tennessee 95-county synthetic sandbox — NOT actual results',
      office: 'Fictional statewide election',
      geographyVintage: '2020',
      dataStatus: 'synthetic',
      candidates: CANDIDATES,
    },
    units,
  };
}

export function serializeFixture(value) { return `${JSON.stringify(value, null, 2)}\n`; }
