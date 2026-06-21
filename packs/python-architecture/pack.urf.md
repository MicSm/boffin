# Python Architecture Pack Index

Portable Python runtime routing surface for native primitive selection, imports, async lifecycle, runtime ownership, schema boundaries, and cleanup.

## ROUTING
R01|leaf=runtime-bootstrap.urf.md|signals=import,bootstrap,serialize,global,entry,setup,borrowed
R02|leaf=state-lifecycle.urf.md|signals=state,runtime,typed,reauth,tasklocal,cancellation,coordinator,refresh
R03|leaf=async-surfaces.urf.md|signals=async,await,guard,lint,bridge,context,thread,concurrency,derived
R04|leaf=boundaries-cleanup.urf.md|signals=payload,schema,protocol,sdk,cleanup,retire,extension,registry
R05|leaf=native-primitives.urf.md|signals=cache,replace,memoize,wrappers,metadata,dunders,format,shadow

## LEAVES
L01|file=runtime-bootstrap.urf.md|theme=bootstrap-imports|stages=1;3
L02|file=state-lifecycle.urf.md|theme=state-lifecycle|stages=2;3
L03|file=async-surfaces.urf.md|theme=async-surfaces|stages=1;4;5
L04|file=boundaries-cleanup.urf.md|theme=boundaries-cleanup|stages=5;6
L05|file=native-primitives.urf.md|theme=python-native-primitives|stages=0

## STAGE-REFS
SR00|refs=PY-K23;PY-K24;PY-K25;PY-K26;PY-K27
SR01|refs=PY-K01;PY-K02
SR02|refs=PY-K03;PY-K04
SR03|refs=PY-K05;PY-K06;PY-K07;PY-K08;PY-K09;PY-K10;PY-K11;PY-K28
SR04|refs=PY-K12;PY-K13;PY-K14
SR05|refs=PY-K15;PY-K16;PY-K17;PY-K18;PY-K19;PY-K20;PY-K29;PY-K30
SR06|refs=PY-K21;PY-K22
