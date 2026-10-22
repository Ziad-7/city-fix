import asyncio
from dataclasses import dataclass
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.ai.transcribe import (
    AudioAnalysis,
    TranscriptionRequest,
    create_transcription_router,
    inspect_audio,
)


class AudioInspectionTests(unittest.TestCase):
    def test_inspection_extracts_duration_and_peak_with_bounded_ffmpeg(self):
        completed = SimpleNamespace(
            returncode=0,
            stderr=(
                "Duration: 00:00:12.50, start: 0.000000, bitrate: 9 kb/s\n"
                "[Parsed_volumedetect_0] max_volume: -55.0 dB\n"
            ),
        )
        with patch("app.ai.transcribe.shutil.which", return_value="/usr/bin/ffmpeg"):
            with patch("app.ai.transcribe.subprocess.run", return_value=completed) as run:
                analysis = inspect_audio(b"audio", "audio/mp4")

        self.assertEqual(analysis, AudioAnalysis(duration_seconds=12.5, peak_dbfs=-55.0))
        command = run.call_args.args[0]
        options = run.call_args.kwargs
        self.assertEqual(command[0], "/usr/bin/ffmpeg")
        self.assertIn("volumedetect", command)
        self.assertIn("-protocol_whitelist", command)
        self.assertLessEqual(options["timeout"], 2)
        self.assertFalse(options["shell"])

    def test_inspection_rejects_malformed_audio(self):
        completed = SimpleNamespace(returncode=1, stderr="invalid data")
        with patch("app.ai.transcribe.shutil.which", return_value="/usr/bin/ffmpeg"):
            with patch("app.ai.transcribe.subprocess.run", return_value=completed):
                with self.assertRaisesRegex(ValueError, "valid audio"):
                    inspect_audio(b"not audio", "audio/mp4")


class TranscriptionAudioRouteTests(unittest.TestCase):
    def request_with_audio_analysis(self, analysis, inspection_error=None):
        calls = []
        self.last_calls = calls

        @dataclass
        class User:
            id: str = "citizen-1"

        async def authenticate():
            return User()

        async def load_voice(_path, _user_id):
            return b"audio", "audio/mp4"

        class Provider:
            async def transcribe(self, _audio, _mime_type):
                calls.append("provider")
                from app.ai.transcribe import Transcription

                return Transcription(
                    text="فيه حفرة", language="ar-EG", confidence=0.9
                )

        router = create_transcription_router(
            get_current_user=authenticate,
            load_authorized_voice=load_voice,
            provider=Provider(),
        )
        endpoint = next(route.endpoint for route in router.routes if route.path == "/ai/transcribe")

        async def call_endpoint():
            async def inspect_in_process(callback, *args):
                return callback(*args)

            with patch(
                "app.ai.transcribe.inspect_audio",
                return_value=analysis,
                side_effect=inspection_error,
            ):
                with patch("app.ai.transcribe.asyncio.to_thread", new=inspect_in_process):
                    result = await endpoint(
                        TranscriptionRequest(path="citizen-1/voice.m4a"),
                        current_user=User(),
                    )
            return result

        return asyncio.run(call_endpoint()), calls

    def test_silence_is_rejected_without_calling_provider(self):
        with self.assertRaises(HTTPException) as error:
            self.request_with_audio_analysis(
                AudioAnalysis(duration_seconds=2.0, peak_dbfs=-91.0)
            )
        self.assertEqual(error.exception.status_code, 422)
        self.assertIn("الصوت واطي", error.exception.detail)

    def test_quiet_speech_is_sent_to_provider(self):
        result, calls = self.request_with_audio_analysis(
            AudioAnalysis(duration_seconds=2.0, peak_dbfs=-60.0)
        )
        self.assertEqual(result.text, "فيه حفرة")
        self.assertEqual(calls, ["provider"])

    def test_malformed_audio_is_rejected_without_calling_provider(self):
        with self.assertRaises(HTTPException) as error:
            self.request_with_audio_analysis(
                AudioAnalysis(duration_seconds=2.0, peak_dbfs=-20.0),
                inspection_error=ValueError("invalid"),
            )
        self.assertEqual(error.exception.status_code, 422)
        self.assertEqual(self.last_calls, [])


if __name__ == "__main__":
    unittest.main()
