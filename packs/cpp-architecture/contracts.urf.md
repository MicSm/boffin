# C++ Contracts Leaf

## KERNELS

```text
CPP-K08|stage=1|scope=contract-first-fault-guarding|kernel=validate raw-pointer buffer-shape and cross-boundary contracts directly at the boundary
CPP-K09|stage=1|scope=identity-width-preservation|kernel=carry pointer handle and callback identity in ABI-correct typed widths end to end
CPP-K10|stage=1|scope=fixed-width-format-cast|kernel=at diagnostic boundaries use fixed-width formatter contracts with explicit casts
CPP-K11|stage=1|scope=success-predicate-match|kernel=choose the success predicate that matches the API's documented contract
CPP-K12|stage=1|scope=accessor-null-guard|kernel=null-check published accessors when reading them from outside their owner
CPP-K13|stage=1|scope=typed-semantic-carriers|kernel=model distinct semantic domains as typed parameters scoped enums or named fields
CPP-K15|stage=1|scope=pool-factory-identity|kernel=construct pooled objects through a factory that passes the pool index into the constructor
CPP-K16|stage=1|scope=canonical-first-fallback|kernel=run canonical resolution first and enter permissive fallback only from a narrowly classified not-found state
CPP-K17|stage=1|scope=encoding-explicit-compare|kernel=require explicit transcoding before comparing string types with different encodings or character widths
CPP-K18|stage=1|scope=build-runtime-context-match|kernel=reject runtime mode requests that the current build was not compiled to support
CPP-K54|stage=1|scope=untrusted-operand-range|kernel=validate the range of untrusted numeric operands before arithmetic whose result feeds a bounds check
```

## EXCLUDES

```text
CPP-X08|stage=1|scope=exception-shields-over-contracts|violation=do not use exception shields or catch-all handlers to paper over broken pointer buffer-shape or cross-boundary contracts
CPP-X09|stage=1|scope=identity-width-truncation|violation=do not narrow pointer handle or callback identity into undersized integers or untyped context slots
CPP-X10|stage=1|scope=ambiguous-format-width|violation=do not use diagnostic format strings whose width contract depends on typedefs toolchain quirks or standard-version details
CPP-X11|stage=1|scope=success-predicate-mismatch|violation=do not treat the absence of one error code as equivalent to the API's real success predicate
CPP-X12|stage=1|scope=unchecked-canonical-accessor-read|violation=do not dereference a published accessor from outside its owner without a null check
CPP-X13|stage=1|scope=opaque-semantic-packing|violation=do not pack unrelated semantic dimensions into opaque integers bitfields or reused parameter slots
CPP-X15|stage=1|scope=posthoc-pool-identity|violation=do not construct pooled objects generically and patch pool identity in later steps when the factory can pass the index at construction
CPP-X16|stage=1|scope=softfail-hijack-fallback|violation=do not turn canonical resolution failures into broad soft-fallbacks that let unrelated alternatives hijack the result
CPP-X17|stage=1|scope=implicit-cross-encoding|violation=do not provide implicit equality or ordering operators between string types that silently smuggle in encoding conversions
CPP-X18|stage=1|scope=incompatible-mode-init|violation=do not let runtime mode selection enter code paths that the binary was not built to implement
CPP-X54|stage=1|scope=overflow-bypassed-bound|violation=do not rely on a bounds check of a computed result as the only guard when intermediate overflow can turn out-of-range operands into an in-range result
```
