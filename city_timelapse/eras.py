"""
Era specifications for the city-block timelapse.

Pure data — no Ursina / rendering dependencies — so it can be unit-tested and
inspected in a headless environment.  Every visual aspect of the scene is
driven from these specs.

Colours are (R, G, B) tuples in the 0-255 range.  They are converted to the
0-1 linear range the renderer expects inside the scene layer.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Tuple

RGB = Tuple[int, int, int]


@dataclass(frozen=True)
class EraSpec:
    """A complete description of how the city block looks in one year."""

    year: int
    name: str
    tagline: str
    description: str

    # --- Sky / atmosphere -------------------------------------------------
    sky_top: RGB
    sky_horizon: RGB
    fog_color: RGB
    fog_density: float          # exponential fog factor (higher = thicker)
    sun_color: RGB
    sun_intensity: float        # 0-1-ish directional light multiplier
    sun_pitch: float            # degrees above horizon
    sun_heading: float          # degrees (compass) of the sun
    ambient: RGB

    # --- Buildings --------------------------------------------------------
    facade_materials: Tuple[str, ...]   # weighted-ish pool, sampled in order
    facade_colors: Tuple[RGB, ...]      # base tint pool for facades
    floors_min: int
    floors_max: int
    floor_height: float          # world metres per storey
    window_style: str            # sash | ribbon | curtain | smart | bio
    window_glow: float           # 0-1 fraction of lit windows at dusk
    dirt: float                  # 0-1 grime overlay
    rooftop: str                 # watertank | antenna | ac | solar | garden

    # --- Vehicles ---------------------------------------------------------
    vehicle_mode: str            # ground | mixed | flying
    vehicle_palette: Tuple[RGB, ...]
    vehicle_count: int

    # --- Pedestrians ------------------------------------------------------
    ped_palette: Tuple[RGB, ...]   # outfit colour sets
    ped_count: int

    # --- Street props -----------------------------------------------------
    streetlight: str           # gas | cobra | led | holo
    tree_maturity: float       # 0-1
    signage: str               # painted | neon | led | holo
    phone_booth: bool          # era has a phone booth / kiosk
    newsstand: bool

    # --- Ground -----------------------------------------------------------
    road_color: RGB
    sidewalk_color: RGB
    road_cracks: float         # 0-1 damage overlay

    # --- Audio ------------------------------------------------------------
    ambient_key: str           # sound key
    ambient_volume: float


# Convenience constructors keep ERA_DATA readable.
def _e(**kw) -> EraSpec:
    return EraSpec(**kw)


ERA_DATA: Dict[int, EraSpec] = {
    1945: _e(
        year=1945,
        name="Post-War Recovery",
        tagline="Rationing ends, the city exhales",
        description=(
            "The block is scarred but stirring. Low brick tenements with "
            "sash windows stand among cleared lots, their rooftops crowded "
            "with water tanks. A few black sedans roll over cracked asphalt "
            "under the glow of gas lamps giving way to electric light."
        ),
        sky_top=(96, 92, 96), sky_horizon=(150, 138, 120),
        fog_color=(168, 156, 140), fog_density=0.018,
        sun_color=(255, 220, 170), sun_intensity=0.85,
        sun_pitch=24.0, sun_heading=210.0, ambient=(70, 66, 70),
        facade_materials=("brick", "brick", "concrete"),
        facade_colors=((120, 70, 52), (138, 86, 60), (110, 104, 96), (96, 78, 58)),
        floors_min=2, floors_max=6, floor_height=3.4,
        window_style="sash", window_glow=0.35, dirt=0.55, rooftop="watertank",
        vehicle_mode="ground",
        vehicle_palette=((28, 28, 30), (40, 44, 56), (60, 60, 64), (90, 80, 60)),
        vehicle_count=4,
        ped_palette=((60, 60, 70), (70, 80, 90), (90, 60, 50), (50, 50, 55)),
        ped_count=7,
        streetlight="gas", tree_maturity=0.18, signage="painted",
        phone_booth=False, newsstand=True,
        road_color=(58, 56, 54), sidewalk_color=(150, 144, 134),
        road_cracks=0.7,
        ambient_key="1945", ambient_volume=0.45,
    ),
    1965: _e(
        year=1965,
        name="Mid-Century Boom",
        tagline="Chrome, optimism and the open road",
        description=(
            "Optimism rebuilds the block in brick and pale concrete. Mid-rise "
            "offices sport ribbon windows and the first curtain walls; "
            "pastel sedans and station wagons multiply beneath humming "
            "cobra-head lamps and fresh neon shop signs."
        ),
        sky_top=(86, 142, 210), sky_horizon=(196, 214, 226),
        fog_color=(200, 214, 224), fog_density=0.010,
        sun_color=(255, 244, 214), sun_intensity=1.05,
        sun_pitch=40.0, sun_heading=230.0, ambient=(120, 124, 134),
        facade_materials=("brick", "concrete", "curtain"),
        facade_colors=((150, 96, 64), (170, 160, 140), (120, 132, 150), (180, 120, 80)),
        floors_min=4, floors_max=12, floor_height=3.5,
        window_style="ribbon", window_glow=0.28, dirt=0.30, rooftop="antenna",
        vehicle_mode="ground",
        vehicle_palette=((120, 200, 210), (220, 200, 150), (200, 80, 70), (90, 110, 150), (230, 230, 230)),
        vehicle_count=8,
        ped_palette=((60, 90, 150), (180, 60, 60), (90, 90, 110), (200, 180, 90), (40, 40, 50)),
        ped_count=10,
        streetlight="cobra", tree_maturity=0.45, signage="neon",
        phone_booth=True, newsstand=True,
        road_color=(52, 52, 56), sidewalk_color=(170, 166, 158),
        road_cracks=0.25,
        ambient_key="1965", ambient_volume=0.6,
    ),
    1985: _e(
        year=1985,
        name="Eighties Excess",
        tagline="Glass towers, neon nights, big hair",
        description=(
            "The block erupts skyward in mirrored glass and bold colour. Boxy "
            "sports cars and hatchbacks jam smoggy streets lit by buzzing "
            "neon and the first flicker of digital signage."
        ),
        sky_top=(90, 70, 130), sky_horizon=(230, 120, 90),
        fog_color=(220, 150, 130), fog_density=0.016,
        sun_color=(255, 170, 120), sun_intensity=0.95,
        sun_pitch=18.0, sun_heading=255.0, ambient=(120, 90, 120),
        facade_materials=("curtain", "curtain", "concrete"),
        facade_colors=((90, 130, 170), (150, 90, 130), (120, 160, 160), (170, 120, 90)),
        floors_min=8, floors_max=26, floor_height=3.6,
        window_style="curtain", window_glow=0.5, dirt=0.22, rooftop="ac",
        vehicle_mode="ground",
        vehicle_palette=((220, 60, 60), (60, 120, 220), (240, 240, 240), (60, 60, 70), (240, 200, 40), (180, 80, 200)),
        vehicle_count=12,
        ped_palette=((220, 60, 120), (60, 200, 200), (80, 80, 200), (240, 240, 240), (40, 40, 40)),
        ped_count=13,
        streetlight="cobra", tree_maturity=0.7, signage="neon",
        phone_booth=True, newsstand=True,
        road_color=(44, 44, 48), sidewalk_color=(176, 172, 166),
        road_cracks=0.2,
        ambient_key="1985", ambient_volume=0.7,
    ),
    2005: _e(
        year=2005,
        name="Digital Dawn",
        tagline="Blue glass, broadband and the SUV",
        description=(
            "Sleek blue-glass towers dominate a tidier block. Silver sedans, "
            "SUVs and the first hybrids hum past LED billboards as "
            "business-casual crowds glance at early smartphones."
        ),
        sky_top=(70, 130, 200), sky_horizon=(190, 208, 222),
        fog_color=(196, 206, 218), fog_density=0.008,
        sun_color=(255, 250, 238), sun_intensity=1.1,
        sun_pitch=48.0, sun_heading=240.0, ambient=(120, 130, 145),
        facade_materials=("curtain", "smart", "curtain"),
        facade_colors=((110, 150, 190), (130, 170, 200), (150, 160, 175), (90, 130, 170)),
        floors_min=12, floors_max=36, floor_height=3.7,
        window_style="curtain", window_glow=0.32, dirt=0.12, rooftop="solar",
        vehicle_mode="ground",
        vehicle_palette=((200, 200, 205), (60, 70, 85), (180, 180, 60), (40, 50, 70), (220, 220, 225), (90, 90, 95)),
        vehicle_count=14,
        ped_palette=((60, 80, 120), (90, 90, 100), (120, 70, 90), (70, 90, 70), (50, 50, 60)),
        ped_count=12,
        streetlight="led", tree_maturity=0.8, signage="led",
        phone_booth=False, newsstand=False,
        road_color=(40, 40, 44), sidewalk_color=(178, 176, 170),
        road_cracks=0.1,
        ambient_key="2005", ambient_volume=0.6,
    ),
    2025: _e(
        year=2025,
        name="Smart Present",
        tagline="Electric, connected, ever-so-slightly watching",
        description=(
            "Smart glass with green roofs rises over silent electric "
            "streets. Sleek EVs and rideshare pods glide past holographic "
            "ads while delivery drones thread between solar rooftops."
        ),
        sky_top=(70, 168, 196), sky_horizon=(196, 228, 230),
        fog_color=(200, 222, 224), fog_density=0.006,
        sun_color=(255, 252, 240), sun_intensity=1.15,
        sun_pitch=52.0, sun_heading=245.0, ambient=(124, 138, 148),
        facade_materials=("smart", "smart", "curtain"),
        facade_colors=((90, 150, 170), (110, 170, 150), (140, 180, 190), (120, 150, 180)),
        floors_min=15, floors_max=44, floor_height=3.7,
        window_style="smart", window_glow=0.3, dirt=0.07, rooftop="solar",
        vehicle_mode="mixed",
        vehicle_palette=((235, 238, 240), (60, 120, 220), (40, 180, 150), (230, 230, 232), (200, 220, 230), (50, 50, 60)),
        vehicle_count=13,
        ped_palette=((40, 120, 160), (200, 90, 110), (90, 180, 120), (60, 60, 70), (220, 180, 120)),
        ped_count=13,
        streetlight="led", tree_maturity=0.92, signage="holo",
        phone_booth=False, newsstand=False,
        road_color=(38, 40, 44), sidewalk_color=(180, 180, 176),
        road_cracks=0.05,
        ambient_key="2025", ambient_volume=0.55,
    ),
    2055: _e(
        year=2055,
        name="Eco-Future",
        tagline="Vertical forests under a luminous sky",
        description=(
            "The block has become a megastructure of vertical forests and "
            "bioluminescent skin. Quiet flying pods drift between glowing "
            "towers as holograms shimmer over garden terraces."
        ),
        sky_top=(60, 180, 200), sky_horizon=(150, 230, 220),
        fog_color=(170, 226, 224), fog_density=0.005,
        sun_color=(230, 255, 250), sun_intensity=1.2,
        sun_pitch=58.0, sun_heading=250.0, ambient=(130, 160, 168),
        facade_materials=("bio", "bio", "smart"),
        facade_colors=((60, 150, 120), (80, 170, 150), (120, 190, 170), (90, 160, 180)),
        floors_min=20, floors_max=60, floor_height=3.8,
        window_style="bio", window_glow=0.25, dirt=0.03, rooftop="garden",
        vehicle_mode="flying",
        vehicle_palette=((120, 230, 255), (180, 255, 220), (255, 240, 200), (160, 200, 255), (220, 200, 255)),
        vehicle_count=10,
        ped_palette=((150, 230, 220), (220, 200, 255), (200, 255, 220), (180, 220, 255), (240, 240, 255)),
        ped_count=11,
        streetlight="holo", tree_maturity=1.0, signage="holo",
        phone_booth=False, newsstand=False,
        road_color=(46, 54, 60), sidewalk_color=(176, 196, 190),
        road_cracks=0.02,
        ambient_key="2055", ambient_volume=0.5,
    ),
}


# Ordered list of years (UI / slider order).
YEARS: List[int] = list(ERA_DATA.keys())


def get_era(year: int) -> EraSpec:
    """Return the EraSpec for *year*, falling back to the nearest era."""
    if year in ERA_DATA:
        return ERA_DATA[year]
    # nearest neighbour (used while a slider is being dragged)
    return ERA_DATA[min(ERA_DATA, key=lambda y: abs(y - year))]


def era_index(year: int) -> int:
    return YEARS.index(year)
