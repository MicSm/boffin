# C++ Architecture Pack Index

Portable C++ runtime routing surface for language mechanics, state modeling, concurrency, lifecycle, shared abstractions, and subsystem boundaries.

## ROUTING
R01|leaf=core.urf.md|signals=nodiscard,forward,pack,bool,assignment,ellipsis
R02|leaf=contracts.urf.md|signals=contract,identity,width,accessor,encoding,fallback
R03|leaf=state-modeling.urf.md|signals=result,callback,category,metadata,load,validation,probe,variant,equality
R04|leaf=concurrency.urf.md|signals=barrier,memory,thread,stream,writer,ordering
R05|leaf=lifecycle.urf.md|signals=raii,start,stop,teardown,publication,worker,transition,scratch
R06|leaf=shared.urf.md|signals=wrapper,trait,helper,allocation,view,owned
R07|leaf=boundaries.urf.md|signals=lto,macro,namespace,snapshot,abi,transport

## LEAVES
L01|file=core.urf.md|theme=language-mechanics|stages=1
L02|file=contracts.urf.md|theme=contracts-typed-boundaries|stages=1
L03|file=state-modeling.urf.md|theme=state-outcome-modeling|stages=2
L04|file=concurrency.urf.md|theme=concurrency-publication|stages=1;3
L05|file=lifecycle.urf.md|theme=ownership-lifecycle|stages=3
L06|file=shared.urf.md|theme=shared-abstractions|stages=4
L07|file=boundaries.urf.md|theme=boundaries-convergence|stages=5;6

## STAGE-REFS
SR01|refs=CPP-K01;CPP-K02;CPP-K03;CPP-K04;CPP-K05;CPP-K06;CPP-K07;CPP-K08;CPP-K09;CPP-K10;CPP-K11;CPP-K12;CPP-K13;CPP-K14;CPP-K15;CPP-K16;CPP-K17;CPP-K18
SR02|refs=CPP-K19;CPP-K20;CPP-K21;CPP-K49;CPP-K50;CPP-K51;CPP-K52
SR03|refs=CPP-K22;CPP-K23;CPP-K24;CPP-K25;CPP-K26;CPP-K27;CPP-K28;CPP-K29;CPP-K30
SR04|refs=CPP-K31;CPP-K32;CPP-K33;CPP-K34;CPP-K35;CPP-K36
SR05|refs=CPP-K37;CPP-K38;CPP-K39;CPP-K40;CPP-K41;CPP-K42;CPP-K43;CPP-K44;CPP-K45;CPP-K46;CPP-K47
SR06|refs=CPP-K48
