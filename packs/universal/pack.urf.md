# Universal Pack Index

Language-agnostic runtime entry surface for ParselFire.

## STAGES
!PURPOSE|turn loaded kernels into a correctness-first decision pipeline that favors consistent code over flat checklist application
!APPLY|for coding and review|walk stages from S00 upward; at each stage gather the K entries named by this stage's refs plus any loaded family STAGE-REFS for the same stage; consult matching EXCLUDES first as a rejection filter, then KERNELS as positive guidance; earlier stages override later ones on conflict; never weaken an earlier-stage invariant to satisfy a later-stage cleanup or convergence goal
!ANTI|consult EXCLUDES at the current stage before reaching for later-stage refactors
!SHOW|on user request|render the active stages selected K/X entries and blocking earlier-stage invariants as concise ordered plain-language bullets in the user's language
S00|name=scope-and-need|focus=stay within requested scope and keep blast radius low without compromising semantic preservation|refs=UNI-K01;UNI-K02;UNI-K03;UNI-K04
S01|name=contracts-and-invariants|focus=prove exact invariants preserve true special cases and obey safety-critical contracts|refs=UNI-K05;UNI-K06;UNI-K07;UNI-K08;UNI-K09;UNI-K10;UNI-K11;UNI-K12;UNI-K13;UNI-K14;UNI-K15;UNI-K38
S02|name=state-and-outcome-modeling|focus=make meaningful states explicit and keep distinct outcomes distinct instead of collapsing them|refs=UNI-K16;UNI-K17;UNI-K18;UNI-K19;UNI-K33;UNI-K34;UNI-K46;UNI-K47;UNI-K48;UNI-K51
S03|name=ownership-and-lifecycle|focus=centralize mutable state clarify ownership tighten setup flows and rebuild live state atomically|refs=UNI-K20;UNI-K21;UNI-K22;UNI-K23;UNI-K49;UNI-K52
S04|name=shared-abstractions|focus=extract shared invariants only after semantics are clear normalize at boundaries and strengthen common utilities before local workarounds|refs=UNI-K24;UNI-K25;UNI-K26;UNI-K27;UNI-K28;UNI-K36;UNI-K37
S05|name=boundaries-and-plumbing|focus=make subsystem boundaries explicit and thread first-class semantics end to end through the real system with minimal caller churn|refs=UNI-K29;UNI-K30;UNI-K31;UNI-K32;UNI-K35;UNI-K39;UNI-K40;UNI-K41;UNI-K45;UNI-K50
S06|name=convergence-and-deletion|focus=once the replacement model is proven converge broadly remove displaced layers and clean runtime and build surfaces together|refs=UNI-K42;UNI-K43;UNI-K44

## ROUTING
R01|leaf=foundations.urf.md|signals=smallest,stdlib,dependency,contract,test
R02|leaf=control-flow.urf.md|signals=special-case,outcome,retry,lookup,completion,clock,merge,timeout,continuation
R03|leaf=lifecycle.urf.md|signals=owner,lifecycle,publish,rebuild,transition,teardown,recovery,failover,degrade
R04|leaf=shared-abstractions.urf.md|signals=shared,extract,duplicate,trampoline,context,parameterize,hook,hierarchy
R05|leaf=boundaries.urf.md|signals=boundary,capability,artifact,normalize,transport,plumbing,log,policy,schema,migration,versioned
R06|leaf=convergence.urf.md|signals=legacy,compat,shim,alias,retire,deprecate

## LEAVES
L01|file=foundations.urf.md|theme=scope-contracts|stages=0;1
L02|file=control-flow.urf.md|theme=control-flow-outcomes|stages=1;2
L03|file=lifecycle.urf.md|theme=ownership-lifecycle|stages=3
L04|file=shared-abstractions.urf.md|theme=shared-invariants|stages=4
L05|file=boundaries.urf.md|theme=boundaries-plumbing|stages=5
L06|file=convergence.urf.md|theme=convergence-deletion|stages=6
