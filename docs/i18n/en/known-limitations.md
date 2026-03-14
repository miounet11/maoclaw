# Known Limitations

This page summarizes the explicit boundaries of `Maozhua v0.1`.

## Main Limitations

- this is a focused trial release, not a default-stable release for every scenario
- deeper SDK and RPC use cases may still require adaptation
- third-party plugin ecosystems are not promised to work without adjustment
- Linux and Windows are not the primary public launch platforms
- enterprise proxy, air-gapped, and complex install environments may require extra handling

## Naming Note

The public product name is `猫爪 / maoclaw`, while the runtime command is still `pi`.  
That creates some cognitive overhead, so the docs need to explain it directly.

## Recommended Approach

- start with macOS, one provider, and the CLI
- validate code understanding and analysis flows first
- expand to RPC, extensions, and more complex workflows afterward
