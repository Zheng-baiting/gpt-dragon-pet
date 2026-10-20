"""Premultiplied-alpha, bidirectional motion interpolation for transparent clips."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'work/tools/python'))
import cv2
import numpy as np
from PIL import Image

cv2.setNumThreads(2)


def prepare_pair(first, second):
    a = np.asarray(first.convert('RGBa'), dtype=np.float32)
    b = np.asarray(second.convert('RGBa'), dtype=np.float32)
    gray_a = cv2.cvtColor(np.asarray(first.convert('RGBA')), cv2.COLOR_RGBA2GRAY)
    gray_b = cv2.cvtColor(np.asarray(second.convert('RGBA')), cv2.COLOR_RGBA2GRAY)
    engine = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    engine.setFinestScale(0)
    forward = engine.calc(gray_a, gray_b, None)
    backward = engine.calc(gray_b, gray_a, None)
    y, x = np.mgrid[:first.height, :first.width].astype(np.float32)
    return a, b, forward, backward, x, y


def interpolate(pair, progress):
    a, b, forward, backward, x, y = pair
    left = cv2.remap(a, x-progress*forward[:, :, 0], y-progress*forward[:, :, 1], cv2.INTER_LINEAR)
    right = cv2.remap(b, x-(1-progress)*backward[:, :, 0], y-(1-progress)*backward[:, :, 1], cv2.INTER_LINEAR)
    pixels = np.clip(np.rint(left*(1-progress) + right*progress), 0, 255).astype(np.uint8)
    return Image.frombytes('RGBa', (a.shape[1], a.shape[0]), pixels.tobytes())
