"""
Headless test suite for the city timelapse.

These tests exercise the pure-logic and asset-generation layers (data,
interpolation, textures, audio) which have no Ursina/display dependency.
They run in the headless CI sandbox and guard against regressions in the
morphing math and procedural asset pipeline.

Run with::

    python -m pytest test_city.py -v
    # or without pytest:
    python test_city.py
"""

import math
import os
import sys
import unittest

# Ensure the package is importable when run directly.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from city_timelapse import eras, interpolation, textures, audio
from city_timelapse.eras import ERA_DATA, YEARS, EraSpec


# ---------------------------------------------------------------------------
# Era data integrity
# ---------------------------------------------------------------------------
class TestEraData(unittest.TestCase):

    def test_expected_years(self):
        self.assertEqual(YEARS, [1945, 1965, 1985, 2005, 2025, 2055])

    def test_all_eras_present(self):
        for y in YEARS:
            self.assertIn(y, ERA_DATA)

    def test_era_fields_complete(self):
        required = {
            "year", "name", "tagline", "description",
            "sky_top", "sky_horizon", "fog_color", "fog_density",
            "sun_color", "sun_intensity", "sun_pitch", "sun_heading",
            "ambient",
            "facade_materials", "facade_colors", "floors_min", "floors_max",
            "floor_height", "window_style", "window_glow", "dirt", "rooftop",
            "vehicle_mode", "vehicle_palette", "vehicle_count",
            "ped_palette", "ped_count",
            "streetlight", "tree_maturity", "signage",
            "phone_booth", "newsstand",
            "road_color", "sidewalk_color", "road_cracks",
            "ambient_key", "ambient_volume",
        }
        for y, e in ERA_DATA.items():
            missing = required - set(e.__dataclass_fields__)
            self.assertFalse(missing, f"{y} missing fields: {missing}")

    def test_rgb_values_in_range(self):
        rgb_fields = ["sky_top", "sky_horizon", "fog_color", "sun_color",
                      "ambient", "road_color", "sidewalk_color"]
        for y, e in ERA_DATA.items():
            for f in rgb_fields:
                val = getattr(e, f)
                for ch in val:
                    self.assertTrue(0 <= ch <= 255, f"{y}.{f}={val} out of range")

    def test_floors_monotonic_and_sensible(self):
        for y, e in ERA_DATA.items():
            self.assertGreaterEqual(e.floors_max, e.floors_min)
            self.assertGreaterEqual(e.floors_min, 1)
            self.assertLessEqual(e.floors_max, 200)
            self.assertGreater(e.floor_height, 0)

    def test_progression_roughly_increasing_heights(self):
        # City grows taller over time.
        avgs = [ERA_DATA[y].floors_max for y in YEARS]
        self.assertGreater(avgs[-1], avgs[0])

    def test_get_era_nearest(self):
        self.assertEqual(eras.get_era(1955).year, 1945)
        self.assertEqual(eras.get_era(1970).year, 1965)


# ---------------------------------------------------------------------------
# Interpolation
# ---------------------------------------------------------------------------
class TestInterpolation(unittest.TestCase):

    def test_exact_year_returns_that_era(self):
        for y in YEARS:
            b = interpolation.blend_eras(float(y))
            self.assertEqual(b.year, y)

    def test_blend_returns_valid_spec(self):
        for yf in [1955, 1975, 1995, 2015, 2040]:
            b = interpolation.blend_eras(yf)
            self.assertIsInstance(b, EraSpec)

    def test_rgb_blend_stays_in_range(self):
        rgb_fields = ["sky_top", "sky_horizon", "fog_color", "sun_color",
                      "ambient", "road_color", "sidewalk_color"]
        for yf in [1950, 1975, 1995, 2015, 2040]:
            b = interpolation.blend_eras(yf)
            for f in rgb_fields:
                for ch in getattr(b, f):
                    self.assertTrue(0 <= ch <= 255, f"{yf}.{f}={getattr(b,f)}")

    def test_numeric_blend_between_keypoints(self):
        # sun_intensity should be between the two neighbouring eras' values
        a = ERA_DATA[1945].sun_intensity
        b = ERA_DATA[1965].sun_intensity
        mid = interpolation.blend_eras(1955).sun_intensity
        self.assertTrue(min(a, b) - 0.01 <= mid <= max(a, b) + 0.01)

    def test_clamping_at_extremes(self):
        # below the range clamps to the first era
        self.assertEqual(interpolation.blend_eras(1000).year, YEARS[0])
        self.assertEqual(interpolation.blend_eras(100).year, YEARS[0])
        # above the range clamps to the last era
        self.assertEqual(interpolation.blend_eras(3000).year, YEARS[-1])

    def test_smoothstep(self):
        self.assertEqual(interpolation.smoothstep(0), 0)
        self.assertEqual(interpolation.smoothstep(1), 1)
        self.assertAlmostEqual(interpolation.smoothstep(0.5), 0.5)

    def test_lerp_rgb_endpoints(self):
        self.assertEqual(interpolation.lerp_rgb((0, 0, 0), (10, 10, 10), 0), (0, 0, 0))
        self.assertEqual(interpolation.lerp_rgb((0, 0, 0), (10, 10, 10), 1), (10, 10, 10))

    def test_palette_blend_length(self):
        b = interpolation.blend_eras(1955)
        # blended palette should be non-empty for every era
        self.assertGreater(len(b.facade_colors), 0)
        self.assertGreater(len(b.vehicle_palette), 0)

    def test_transition_progress_bell(self):
        # at a key year progress ~0 (1955 is the midpoint, not a key year!)
        self.assertAlmostEqual(interpolation.transition_progress(1945), 0, places=1)
        self.assertAlmostEqual(interpolation.transition_progress(1965), 0, places=1)
        # midway between two key years peaks ~1
        self.assertGreater(interpolation.transition_progress(1955), 0.9)
        self.assertGreater(interpolation.transition_progress(1975), 0.9)


# ---------------------------------------------------------------------------
# Textures
# ---------------------------------------------------------------------------
class TestTextures(unittest.TestCase):

    def test_facade_dimensions(self):
        for y in YEARS:
            e = ERA_DATA[y]
            img = textures.facade_texture(e, floors=8, seed=y)
            self.assertEqual(img.size[0], 256)
            self.assertEqual(img.size[1], 32 * 8)

    def test_facade_mode_rgb(self):
        for y in YEARS:
            e = ERA_DATA[y]
            img = textures.facade_texture(e, floors=4, seed=y)
            self.assertEqual(img.mode, "RGB")

    def test_road_texture(self):
        for y in YEARS:
            img = textures.road_texture(ERA_DATA[y])
            self.assertEqual(img.size[0], 512)
            self.assertEqual(img.size[1], 512)

    def test_sidewalk_texture(self):
        for y in YEARS:
            img = textures.sidewalk_texture(ERA_DATA[y])
            self.assertEqual(img.size[0], 256)
            self.assertEqual(img.size[1], 256)

    def test_signage_varies_by_era(self):
        imgs = set()
        for y in YEARS:
            data = textures.pil_to_bytes(
                textures.signage_texture(ERA_DATA[y], seed=y, lit=True))
            imgs.add(data)
        # at least a few distinct signs across eras
        self.assertGreater(len(imgs), 2)

    def test_sky_gradient_shape(self):
        img = textures.sky_gradient(ERA_DATA[2025])
        self.assertEqual(img.size[1], 256)

    def test_all_textures_no_blank(self):
        # every texture should have pixel variance (not a flat fill)
        from PIL import ImageChops
        import numpy as np
        for y in YEARS:
            e = ERA_DATA[y]
            img = textures.facade_texture(e, floors=6, seed=y)
            arr = np.array(img).astype(int)
            self.assertGreater(arr.std(), 5, f"{y} facade too flat")


# ---------------------------------------------------------------------------
# Audio
# ---------------------------------------------------------------------------
class TestAudio(unittest.TestCase):

    def test_ambient_valid_wav(self):
        for y in YEARS:
            data = audio.ambient_loop_bytes(ERA_DATA[y], duration=1.0)
            self.assertTrue(data[:4] == b"RIFF")
            self.assertIn(b"WAVE", data[:12])

    def test_whoosh_valid_wav(self):
        data = audio.transition_whoosh_bytes()
        self.assertTrue(data[:4] == b"RIFF")

    def test_click_valid_wav(self):
        data = audio.click_sfx_bytes()
        self.assertTrue(data[:4] == b"RIFF")

    def test_ambient_bank_caches(self):
        bank = audio.AmbientBank()
        b1 = bank.get(ERA_DATA[1985])
        b2 = bank.get(ERA_DATA[1985])
        self.assertIs(b1, b2)
        self.assertIn("1985", bank.keys())

    def test_ambient_durations_reasonable(self):
        for y in YEARS:
            data = audio.ambient_loop_bytes(ERA_DATA[y], duration=2.0)
            # WAV header bytes 40-43 = data size; sample rate 22050, mono, 16bit
            self.assertGreater(len(data), 4000)

    def test_distinct_eras_distinct_sound(self):
        a = audio.ambient_loop_bytes(ERA_DATA[1945], duration=1.0)
        b = audio.ambient_loop_bytes(ERA_DATA[2055], duration=1.0)
        self.assertNotEqual(hash(a), hash(b))


# ---------------------------------------------------------------------------
# Scene import & structural integrity (does not start Ursina)
# ---------------------------------------------------------------------------
class TestSceneModule(unittest.TestCase):

    def test_scene_module_imports(self):
        import city_timelapse.scene as sc
        self.assertTrue(hasattr(sc, "main"))
        self.assertTrue(hasattr(sc, "CityScene"))

    def test_buildings_module_imports(self):
        import city_timelapse.buildings as bld
        self.assertTrue(hasattr(bld, "generate_block"))
        self.assertTrue(hasattr(bld, "Building"))

    def test_props_module_imports(self):
        import city_timelapse.props as pr
        self.assertTrue(hasattr(pr, "VehicleSystem"))
        self.assertTrue(hasattr(pr, "PedestrianSystem"))
        self.assertTrue(hasattr(pr, "StreetProps"))

    def test_entry_points_exist(self):
        import importlib.util
        self.assertTrue(importlib.util.find_spec("city_timelapse"))
        # __main__ module
        import city_timelapse.__main__


# ---------------------------------------------------------------------------
# Geometry builders — regression test that caught the walrus-operator bug
# in props.py.  Exercises the full code path without a GPU.
# ---------------------------------------------------------------------------
class TestGeometryBuilders(unittest.TestCase):

    def test_buildings_generate_for_every_era(self):
        from city_timelapse import buildings
        for y in YEARS:
            bl = buildings.generate_block(ERA_DATA[y], block_radius=22.0)
            self.assertGreater(len(bl), 0, f"{y}: no buildings")
            for b in bl:
                self.assertGreater(len(b.entities), 0)
                b.destroy()

    def test_vehicle_system_counts(self):
        from city_timelapse import props
        for y in YEARS:
            vs = props.VehicleSystem(ERA_DATA[y])
            self.assertEqual(len(vs.vehicles), ERA_DATA[y].vehicle_count)
            vs.update(1.0, 22.0)
            vs.destroy()

    def test_pedestrian_system_counts(self):
        from city_timelapse import props
        for y in YEARS:
            ps = props.PedestrianSystem(ERA_DATA[y])
            self.assertEqual(len(ps.peds), ERA_DATA[y].ped_count)
            ps.update(1.0)
            ps.destroy()

    def test_street_props_builds_all_features(self):
        """Regression: the walrus `era :=` reassignment used to break
        tree_maturity / signage / phone_booth access."""
        from city_timelapse import props
        for y in YEARS:
            sp = props.StreetProps(ERA_DATA[y], block_radius=22.0)
            self.assertGreater(len(sp.entities), 10, f"{y}: too few props")
            sp.destroy()

    def test_builder_build_and_destroy_cycle(self):
        from city_timelapse import buildings, props
        from city_timelapse.scene import CitySceneBuilder
        builder = CitySceneBuilder(parent=None)
        for y in YEARS:
            builder.build(ERA_DATA[y], 22.0)
            builder.update_actors(1.0, 22.0)
            builder.destroy()


if __name__ == "__main__":
    unittest.main(verbosity=2)
