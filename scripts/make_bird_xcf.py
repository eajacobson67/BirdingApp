"""
Creates a blank 1080x1080 XCF template for a new bird icon.
Usage: py scripts/make_bird_xcf.py <filename_stem> [hex_color ...]
  e.g. py scripts/make_bird_xcf.py blue_jay 3a7bd5 ffffff aecbee 8a9bb0 1a2a4a

Generates assets/birds/<filename_stem>.xcf with:
  - Layer 'Background': transparent 1080x1080
  - Layer 'Palette': 30x30 color swatches, bottom-right corner

Uses XCF v002 format, COMPRESS_NONE — readable by all GIMP 2.x+.
"""

import sys, os, struct, math

TILE = 64  # GIMP tile size

# ── pack helpers ──────────────────────────────────────────────────────────────

def u32(v):  return struct.pack('>I', int(v) & 0xFFFFFFFF)
def f32(v):  return struct.pack('>f', float(v))
def i32(v):  return struct.pack('>i', int(v))

def xcf_str(s):
    enc = s.encode('utf-8') + b'\x00'
    return u32(len(enc)) + enc

def prop(ptype, data):
    return u32(ptype) + u32(len(data)) + data

PROP_END = u32(0) + u32(0)

# ── tile builders ─────────────────────────────────────────────────────────────

def tile_transparent(tw, th):
    """COMPRESS_NONE: interleaved RGBA zeros = fully transparent."""
    return bytes(tw * th * 4)  # all zeros = transparent regardless of layout


def tile_pixels(tw, th, pixels):
    """pixels: list of (r,g,b,a) length tw*th, stored INTERLEAVED for COMPRESS_NONE."""
    out = bytearray(tw * th * 4)
    for i, (r, g, b, a) in enumerate(pixels):
        out[i*4]   = r
        out[i*4+1] = g
        out[i*4+2] = b
        out[i*4+3] = a
    return bytes(out)


# ── layer builder ─────────────────────────────────────────────────────────────

def build_layer(abs_offset, width, height, name, get_tile):
    """
    Build complete layer bytes starting at `abs_offset` in the final file.
    get_tile(col, row, tw, th) -> bytes for that tile.
    Returns bytes.
    """
    ncols  = math.ceil(width  / TILE)
    nrows  = math.ceil(height / TILE)
    ntiles = ncols * nrows

    # -- layer properties --
    lprops  = prop(6,  u32(255))           # PROP_OPACITY
    lprops += prop(7,  u32(28))            # PROP_MODE (NORMAL)
    lprops += prop(8,  u32(1))             # PROP_VISIBLE
    lprops += prop(9,  u32(0))             # PROP_LINKED
    lprops += prop(10, u32(0))             # PROP_LOCK_ALPHA
    lprops += prop(11, u32(0))             # PROP_APPLY_MASK
    lprops += prop(12, u32(0))             # PROP_EDIT_MASK
    lprops += prop(13, u32(0))             # PROP_SHOW_MASK
    lprops += prop(15, i32(0) + i32(0))   # PROP_OFFSETS
    lprops += PROP_END

    # -- compute layout --
    # Layer header section: w(4)+h(4)+type(4)+name+props+hier_off(4)+mask_off(4)
    layer_hdr_len = 4 + 4 + 4 + len(xcf_str(name)) + len(lprops) + 4 + 4

    # Hierarchy section: w(4)+h(4)+bpp(4)+level_off(4)+null(4)
    hier_len = 20

    # Level header section: w(4)+h(4)+tile_offs((ntiles+1)*4)
    level_hdr_len = 4 + 4 + (ntiles + 1) * 4

    # Absolute positions
    hier_pos        = abs_offset + layer_hdr_len
    level_pos       = hier_pos + hier_len
    tile_table_pos  = level_pos + 8          # skip level w+h
    first_tile_pos  = tile_table_pos + (ntiles + 1) * 4

    # -- generate tile data and record their offsets --
    tile_offsets = []
    tile_blobs   = []
    pos = first_tile_pos
    for row in range(nrows):
        for col in range(ncols):
            tw = min(TILE, width  - col * TILE)
            th = min(TILE, height - row * TILE)
            tb = get_tile(col, row, tw, th)
            tile_offsets.append(pos)
            tile_blobs.append(tb)
            pos += len(tb)

    # -- assemble --
    out = b''

    # Layer header
    out += u32(width) + u32(height) + u32(1)  # type 1 = RGBA
    out += xcf_str(name)
    out += lprops
    out += u32(hier_pos)
    out += u32(0)                             # mask offset = none

    # Hierarchy
    out += u32(width) + u32(height) + u32(4)  # bpp = 4
    out += u32(level_pos)
    out += u32(0)                             # level list null terminator

    # Level header
    out += u32(width) + u32(height)
    for toff in tile_offsets:
        out += u32(toff)
    out += u32(0)                             # tile list null terminator

    # Tile data
    for tb in tile_blobs:
        out += tb

    return out


# ── palette layer helper ──────────────────────────────────────────────────────

def build_palette_layer(abs_offset, width, height, colors):
    """Layer with colored swatches in the bottom-right corner."""
    SWATCH = 30
    GAP    = 10
    MARGIN = 20

    # pre-compute which pixels should be colored
    swatch_map = {}  # (x, y) -> (r, g, b, 255)
    for idx, (r, g, b) in enumerate(reversed(colors)):
        x0 = width  - MARGIN - (idx + 1) * SWATCH - idx * GAP
        y0 = height - MARGIN - SWATCH
        for dy in range(SWATCH):
            for dx in range(SWATCH):
                swatch_map[(x0 + dx, y0 + dy)] = (r, g, b, 255)

    def get_tile(col, row, tw, th):
        bx, by = col * TILE, row * TILE
        # quick check: does any swatch pixel fall in this tile?
        any_hit = any(
            bx <= x < bx + tw and by <= y < by + th
            for (x, y) in swatch_map
        )
        if not any_hit:
            return tile_transparent(tw, th)
        pixels = [swatch_map.get((bx + dx, by + dy), (0, 0, 0, 0))
                  for dy in range(th) for dx in range(tw)]
        return tile_pixels(tw, th, pixels)

    return build_layer(abs_offset, width, height, 'Palette', get_tile)


# ── file assembler ────────────────────────────────────────────────────────────

def make_xcf(out_path, width, height, colors):
    # Image-level header and properties
    hdr = b'gimp xcf v002\x00'
    img_hdr = u32(width) + u32(height) + u32(0)   # image type 0 = RGB

    img_props  = prop(17, b'\x00')                  # PROP_COMPRESSION = NONE
    img_props += prop(19, f32(300.0) + f32(300.0))  # PROP_RESOLUTION
    img_props += prop(22, u32(1))                    # PROP_UNIT = inches
    img_props += prop(20, u32(2))                    # PROP_TATTOO counter
    img_props += PROP_END

    # Layer names — XCF order is top-to-bottom in GIMP's Layers panel.
    # Palette is at the very top as a non-destructive reference.
    # Drawing layers go front-to-back: wing1 → beak → eyes → decor → belly → body → wing2.
    drawing_layers = ['wing1', 'beak', 'eyes', 'decor', 'belly', 'body', 'wing2']
    all_layer_names = ['Palette'] + drawing_layers  # 8 layers total

    # Layer offset table: (n_layers + 1) × u32 (null terminator)
    n_layers = len(all_layer_names)
    layer_table_len = (n_layers + 1) * 4
    chan_table_len  = 1 * 4

    prefix_len = len(hdr) + len(img_hdr) + len(img_props) + layer_table_len + chan_table_len

    # Build each layer blob in order, tracking running file offset
    transparent = lambda col, row, tw, th: tile_transparent(tw, th)
    layer_blobs = []
    cursor = prefix_len
    for name in all_layer_names:
        if name == 'Palette':
            blob = build_palette_layer(cursor, width, height, colors)
        else:
            blob = build_layer(cursor, width, height, name, transparent)
        layer_blobs.append((cursor, blob))
        cursor += len(blob)

    # Assemble prefix with patched layer offsets
    layer_table_start = len(hdr) + len(img_hdr) + len(img_props)
    prefix = bytearray(hdr + img_hdr + img_props + bytes(layer_table_len + chan_table_len))
    for i, (abs_off, _) in enumerate(layer_blobs):
        struct.pack_into('>I', prefix, layer_table_start + i * 4, abs_off)
    # remaining entries (null terminator + channel null) are already 0 ✓

    with open(out_path, 'wb') as f:
        f.write(prefix)
        for _, blob in layer_blobs:
            f.write(blob)

    size = os.path.getsize(out_path)
    print(f'Written: {out_path}  ({size:,} bytes, {size//1024//1024}MB)')


# ── entry point ───────────────────────────────────────────────────────────────

def hex_to_rgb(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: py scripts/make_bird_xcf.py <filename_stem> [hex_color ...]')
        print('  e.g: py scripts/make_bird_xcf.py blue_jay 3a7bd5 ffffff aecbee 8a9bb0 1a2a4a')
        sys.exit(1)

    stem     = sys.argv[1]
    hex_args = sys.argv[2:]
    colors   = [hex_to_rgb(h) for h in hex_args] if hex_args else [(180, 180, 180)]

    out_dir  = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'birds')
    out_path = os.path.normpath(os.path.join(out_dir, stem + '.xcf'))

    make_xcf(out_path, 1080, 1080, colors)
