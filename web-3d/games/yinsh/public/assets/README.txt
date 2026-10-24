YINSH piece GLBs (ring/marker, black and white).

Committed files are meshopt-compressed (EXT_meshopt_compression) with WebP textures. Before committing changes, run from web-3d:

  npm run compress-glb

Load at runtime via @abstract/three-engine (ensureMeshoptDecoderReady / loadGltfAsync).

Y-up, meters, base-centered origin. Ring opening clears the marker; markers are separate meshes per color.
