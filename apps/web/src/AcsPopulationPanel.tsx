import { useMemo } from "react";
import type { AcsDimension, AcsSourceState } from "./acs-source";
import { acsUniverseLabel, sumSelectedAcsPopulation } from "./acs-source";

const fmt=(value:number)=>new Intl.NumberFormat("en-US").format(value);
export interface AcsPopulationPanelProps {
  dimension: AcsDimension;
  source: AcsSourceState;
  selectedIds: readonly string[];
  weights: Record<string,number>;
  onWeightChange: (id:string,weight:number)=>void;
  acknowledged: boolean;
  modelActive: boolean;
  fitReady: boolean;
  onStart:(dimension:AcsDimension,weights:Record<string,number>)=>boolean;
}

export function AcsPopulationPanel({dimension,source,selectedIds,weights,onWeightChange,
  acknowledged,modelActive,fitReady,onStart}:AcsPopulationPanelProps) {
  const summary=useMemo(()=>
    source.status==="available" && selectedIds.length>0
      ? sumSelectedAcsPopulation(source,selectedIds) : null,
    [source,selectedIds]);
  const table=dimension==="age"?"B01001":"B15003";
  const provenance=source.status==="available" ? source.provenance as Record<string,unknown> : null;
  const sourceEntry=(provenance?.tables as Record<string,Record<string,unknown>> | undefined)?.[table];
  const officialUrl=typeof sourceEntry?.sourceUrl==="string" &&
    /^https:\/\/(?:[a-z0-9.-]+\.)?census\.gov\//i.test(sourceEntry.sourceUrl) ? sourceEntry.sourceUrl : null;
  const digest=typeof sourceEntry?.fullSourceSha256==="string" &&
    /^[a-f0-9]{64}$/i.test(sourceEntry.fullSourceSha256) ? sourceEntry.fullSourceSha256 : null;
  return (
    <section className="acs-source-panel" aria-label="Census population composition">
      <div className="acs-source-heading">
        <span className="eyebrow">CENSUS ESTIMATES · NOT VOTING RECORDS</span>
        <h4>{dimension==="age"?"Age composition":"Educational attainment"}</h4>
        <p>2024 ACS 5-year <strong>population estimate</strong> · U.S. Census Bureau · detailed table {table}.
          {dimension==="age"?" Adults age 18+ only.":" People age 25+ only."}</p>
      </div>
      <div className="acs-two-truths" role="note">
        <div><strong>Observed source estimates</strong>
          <span>Estimated resident population, category composition and source uncertainty; never candidate votes</span></div>
        <div><strong>Hypothetical modeling</strong>
          <span>Any modeled electorate weight, turnout, candidate support or eligible allocation is a user assumption</span></div>
      </div>
      {source.status==="unavailable"?(
        <div role="status" className="acs-unavailable" data-testid="acs-source-unavailable">
          <strong>Verified ACS profiles unavailable</strong>
          <p>{source.reason}</p>
          <p>Age and education modes are disabled until E3's verified Census source and E2's modeled-electorate adapter are integrated. The functional fictional demo remains separate.</p>
        </div>
      ):(
        <>
          <div className="acs-source-proof" data-testid="acs-source-metadata">
            <strong>Source-backed population profile loaded</strong>
            <small>2024 ACS 5-year · {table} · Census 2020 county GEOIDs · 95 Tennessee counties · U.S. Census Bureau</small>
            <small>Universe: {acsUniverseLabel(dimension)}. ACS data are statistical estimates with uncertainty, NOT actual subgroup voter counts.</small>
            {officialUrl && <small><a href={officialUrl} target="_blank" rel="noopener noreferrer">Official Census {table} source file</a></small>}
            {digest && <small data-testid="acs-source-sha256">Original table SHA-256: {digest}</small>}
            <small>Estimates use the 2020–2024 ACS five-year period; subgroup preferences are never observed.</small>
          </div>
          {!summary?(
            <p className="info-note" role="status">Select one county, several counties, or all Tennessee on the map to inspect published population composition.</p>
          ):(
            <>
              <div className="acs-population-total">
                <span>Source-estimated population · {summary.countyCount} selected TN {summary.countyCount===1?"county":"counties"}</span>
                <strong data-testid="acs-population-denominator">{fmt(summary.universeEstimate)} residents</strong>
                <small>{acsUniverseLabel(dimension)} · NOT eligible voters, ballots or registered voters</small>
              </div>
              <div className="acs-category-list" aria-label="Source population group composition">
                {summary.categoryTotals.map(group=>{
                  const weight=weights[group.id]??1;
                  return <div className="acs-category" key={group.id}>
                    <div className="acs-category-heading"><strong>{group.label}</strong><span data-testid={`acs-share-${group.id}`}>{group.percentage.toFixed(1)}%</span></div>
                    <div className="acs-category-bar"><span style={{width:`${group.percentage}%`}}/></div>
                    <small>{fmt(group.estimate)} estimated residents · {group.sourceVariables.join(", ")} · source POPULATION share</small>
                    {!modelActive && <div className="acs-weight-control">
                      <label htmlFor={`acs-weight-${group.id}`}>Hypothetical electorate weight</label>
                      <input id={`acs-weight-${group.id}`} type="range" min="0" max="2" step="0.05"
                        aria-label={`Hypothetical electorate weight for ${group.label}`}
                        value={weight} onChange={event=>onWeightChange(group.id,Number(event.target.value))}/>
                      <output htmlFor={`acs-weight-${group.id}`}>{weight.toFixed(2)}×</output>
                    </div>}
                  </div>;
                })}
              </div>
              <p className="help-text">{modelActive
                ? "These source population shares remain fixed. The already-fitted modeled electorate has separate hypothetical support and turnout; this panel does not reconstruct or invent old fitting weights on project import."
                : "All weight sliders start at 1.00× by explicit user choice, not as estimated voting propensity. They alter a hypothetical partition of synthetic county ballots through E2's fit; no Census population counts or original ballots change."}
                Model selection uses one dimension only. Age 18+ and education 25+ are distinct marginals and cannot be multiplied into a joint electorate.</p>
            </>
          )}
        </>
      )}
      <button type="button" className="action-button" disabled={
        !acknowledged||modelActive||source.status!=="available"||!fitReady||!summary||
        summary.universeEstimate===0||
        summary.categoryTotals.some(category=>!Number.isFinite(weights[category.id]) ||
          weights[category.id]! < 0 || weights[category.id]! > 2)
      } onClick={()=>onStart(dimension,{...weights})}>
        Start source-labeled hypothetical {dimension} model
      </button>
      {source.status==="available"&&!fitReady&&
        <p className="model-save-warning" data-testid="acs-fit-unavailable">Verified population estimates are available, but E2's canonical modeled-electorate fit is not yet integrated. Modeling is unavailable; Census data are not converted in the browser.</p>}
    </section>
  );
}
