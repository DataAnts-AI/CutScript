"""
AI background removal (Phase 5 - future).
Uses MediaPipe or Robust Video Matting for person segmentation.
Export-only -- no real-time preview.
"""

import logging

logger = logging.getLogger(__name__)

# Placeholder for Phase 5 implementation
# Will use mediapipe or rvm for segmentation at export time

MEDIAPIPE_AVAILABLE = False
RVM_AVAILABLE = False

try:
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    pass

try:
    pass  # rvm import would go here
except ImportError:
    pass


def is_available() -> bool:
    return MEDIAPIPE_AVAILABLE or RVM_AVAILABLE


def remove_background_on_export(
    input_path: str,
    output_path: str,
    replacement: str = "blur",
    replacement_value: str = "",
) -> str:
    """
    Process video frame-by-frame to remove/replace background.
    Only runs during export (not real-time).

    Args:
        input_path: source video
        output_path: destination
        replacement: 'blur', 'color', 'image', or 'video'
        replacement_value: hex color, image path, or video path

    Returns:
        output_path
    """
    if not is_available():
        raise RuntimeError(
            "Background removal requires mediapipe or robust-video-matting. "
            "Install with: pip install mediapipe"
        )

    # Phase 5 implementation will go here
    raise NotImplementedError("Background removal is planned for Phase 5")
