# C++ Lifecycle Leaf

## KERNELS

```text
CPP-K22|stage=3|scope=raii-guard-ownership-move|kernel=arm the RAII owner with the raw resource before later work can throw or allocate
CPP-K23|stage=3|scope=ctor-start-stop-split|kernel=split producer-like subsystems into inert construction plus explicit Start and Stop phases
CPP-K24|stage=3|scope=publication-after-start|kernel=publish canonical accessors only after all required internal producers have started successfully
CPP-K25|stage=3|scope=reverse-teardown-order|kernel=encode teardown in reverse startup order for composite objects with multiple registrations
CPP-K26|stage=3|scope=instance-owned-control-state|kernel=attach mutable control state to the concrete runtime instance that advances it
CPP-K28|stage=3|scope=owned-worker-join|kernel=treat launched worker threads as owned lifecycle resources by waking blockers and joining every worker on teardown paths
CPP-K29|stage=3|scope=context-owned-scratch|kernel=keep per-resource scratch state on the owning processor or resolver instance
CPP-K30|stage=3|scope=loop-phased-transition|kernel=queue state transitions and run enter exit cleanup and destruction at a stable main-loop phase with explicit previous and next states
CPP-K53|stage=3|scope=canonical-owner-free|kernel=free a shared resource only through its single canonical owner and treat every other holder or error path that only borrowed the reference as non-owning
```

## EXCLUDES

```text
CPP-X22|stage=3|scope=deferred-guard-arm|violation=do not create an empty RAII owner and arm it only after later work can throw or allocate
CPP-X23|stage=3|scope=ctor-bound-registration|violation=do not perform callback or hook registration directly inside constructors and hope destructor cleanup will model the lifecycle
CPP-X24|stage=3|scope=premature-canonical-publication|violation=do not publish a canonical accessor before all required producers have started successfully
CPP-X25|stage=3|scope=teardown-order-implicit|violation=do not rely on implicit destructor behavior when rollback and unload need a defined reverse-of-start sequence
CPP-X26|stage=3|scope=globalized-control-state|violation=do not store per-instance control state in a process-wide owner and let one instance affect unrelated coexisting instances
CPP-X28|stage=3|scope=detached-worker-lifecycle|violation=do not detach executor-owned worker threads or wait uninterruptibly on dependencies during cancellation and teardown
CPP-X29|stage=3|scope=global-scratch-state|violation=do not store per-resource temporary state in static globals reused across independent requests or resolver instances
CPP-X30|stage=3|scope=inline-half-transition|violation=do not perform state enter exit and teardown inline inside setters where mid-frame work can observe half-transitioned state
CPP-X53|stage=3|scope=borrowed-ref-double-free|violation=do not free a resource from a borrowed reference or an error path when another structure is its canonical owner and will free it during normal teardown
```
