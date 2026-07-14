# Fix: false `-a` target-feature detection

The previous runner used this broad check:

```bash
grep -q 'target-feature=.*-a' Makefile
```

That expression incorrectly matched the `-a` substring in
`passes=lower-atomic`, even though the actual target feature list did not
contain `-a`.

The runner now checks only for a real comma-separated `-a` feature inside the
`target-feature=` value:

```bash
grep -Eq 'target-feature=[^[:space:]]*,-a(,|[[:space:]]|$)' Makefile
```

The correct build flags remain:

```text
-C target-feature=+zba,+zbb,+zbc,+zbs -C passes=lower-atomic
```
