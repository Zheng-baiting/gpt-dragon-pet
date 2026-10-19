"""End-to-end media checks with a geometric test fixture, never a pet action."""
import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from pipeline import ROOT, FFMPEG, run, process, info, assert_alpha, retime
import numpy as np
from PIL import Image, ImageDraw
from motion import prepare_pair, interpolate


class PipelineTest(unittest.TestCase):
    def test_green_to_normalized_transparent_120fps(self):
        with tempfile.TemporaryDirectory(dir=ROOT / 'work', prefix='pipeline-test-') as directory:
            folder = Path(directory)
            source = folder / 'fixture.mp4'
            run([FFMPEG, '-y', '-loglevel', 'error', '-f', 'lavfi', '-i',
                 'color=0x00FF00:s=1280x720:r=24', '-vf',
                 'drawbox=x=590:y=180:w=100:h=432:color=white:t=fill,drawbox=x=20:y=20:w=20:h=20:color=white:t=fill',
                 '-t', '0.5', '-c:v', 'libx264', '-crf', '18', str(source)], check=True)
            # Isolate all fixture outputs from real generation jobs.
            from unittest.mock import patch
            with patch('pipeline.ROOT', folder):
                (folder / 'assets').mkdir()
                (folder / 'assets/actions.json').write_text('[{"name":"fixture"}]', encoding='utf-8')
                # Vendor modules remain the actual, unchanged project sources.
                (folder / 'vendor').mkdir()
                import shutil
                shutil.copytree(ROOT / 'vendor/dsh-pet', folder / 'vendor/dsh-pet')
                with contextlib.redirect_stdout(io.StringIO()):
                    process('fixture', source, True, (240, 0, 800, 720))
            output = folder / 'work/pipeline/fixture/video-120fps.webm'
            metadata = info(output)
            self.assertEqual(metadata['r_frame_rate'], '120/1')
            self.assertAlmostEqual(metadata['duration'], .5, delta=.02)
            assert_alpha(output)
            decoded = run([FFMPEG, '-loglevel', 'error', '-c:v', 'libvpx-vp9', '-i', str(output),
                           '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
                          check=True, capture_output=True).stdout
            pixels = np.frombuffer(decoded, np.uint8).reshape(360, 640, 4)
            y, x = np.where(pixels[:, :, 3] > 128)
            self.assertLessEqual(abs(float(x.mean())-320), 2)
            self.assertLessEqual(abs(int(y.max())-330), 2)
            self.assertGreater(pixels[200, 320, 3], 240)
            self.assertLess(pixels[0, 0, 3], 5)
            report = json.loads((output.parent / 'report.json').read_text(encoding='utf-8'))
            self.assertEqual(report['frames'], 60)
            self.assertTrue(report['manualReviewRequired'])
            self.assertEqual(report['extractionRegion'], [240, 0, 800, 720])

    def test_motion_has_a_new_intermediate_position(self):
        frames = []
        for x in (100, 120):
            frame = Image.new('RGBA', (640, 360))
            ImageDraw.Draw(frame).rectangle((x, 100, x+60, 200), fill='#ffffff')
            frames.append(frame)
        result = np.asarray(interpolate(prepare_pair(*frames), .5).convert('RGBA'))
        y, x = np.where(result[:, :, 3] > 200)
        self.assertTrue(136 < x.mean() < 144)
        self.assertEqual(int(result[0, 0, 3]), 0)

    def test_alpha_input_preserves_green_props(self):
        with tempfile.TemporaryDirectory(dir=ROOT / 'work', prefix='alpha-color-test-') as directory:
            folder = Path(directory)
            frame = Image.new('RGBA', (640, 360))
            ImageDraw.Draw(frame).rectangle((200, 100, 400, 300), fill='#00ff00')
            source, output = folder / 'source.webm', folder / 'output.webm'
            run([FFMPEG, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba',
                 '-s', '640x360', '-r', '24', '-i', '-', '-an', '-c:v', 'libvpx-vp9',
                 '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0', str(source)],
                input=frame.tobytes()*2, check=True)
            self.assertEqual(retime(source, output), 10)
            pixels = run([FFMPEG, '-loglevel', 'error', '-c:v', 'libvpx-vp9', '-i', str(output),
                          '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
                         check=True, capture_output=True).stdout
            pixel = np.frombuffer(pixels, np.uint8).reshape(360, 640, 4)[200, 300]
            self.assertGreater(int(pixel[1]), 220)
            self.assertLess(int(pixel[0]), 30)
            self.assertGreater(int(pixel[3]), 240)


if __name__ == '__main__':
    unittest.main()
