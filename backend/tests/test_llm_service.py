import unittest
from unittest.mock import MagicMock, patch
from app.services.llm_groq import LLMService


class LLMServiceTest(unittest.TestCase):
    @patch("app.services.llm_groq.Groq")
    @patch("app.services.llm_groq.genai")
    @patch("app.services.llm_groq.get_settings")
    def test_groq_success(self, mock_get_settings, mock_genai, mock_groq_class):
        # Setup settings with keys
        mock_settings = MagicMock()
        mock_settings.groq_api_key = "test-groq-key"
        mock_settings.gemini_api_key = "test-gemini-key"
        mock_get_settings.return_value = mock_settings

        # Mock Groq client response
        mock_groq_client = MagicMock()
        mock_groq_class.return_value = mock_groq_client
        mock_response = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = "Groq response"
        mock_response.choices = [mock_choice]
        mock_groq_client.chat.completions.create.return_value = mock_response

        # Mock Gemini client initialization
        mock_gemini_client = MagicMock()
        mock_genai.Client.return_value = mock_gemini_client

        # Instantiate service and call generate
        service = LLMService()
        result = service.generate("Test prompt")

        self.assertEqual(result, "Groq response")
        mock_groq_client.chat.completions.create.assert_called_once()
        # Gemini generate_content should not have been called
        mock_gemini_client.models.generate_content.assert_not_called()

    @patch("app.services.llm_groq.Groq")
    @patch("app.services.llm_groq.genai")
    @patch("app.services.llm_groq.get_settings")
    def test_groq_fail_gemini_fallback(self, mock_get_settings, mock_genai, mock_groq_class):
        # Setup settings with keys
        mock_settings = MagicMock()
        mock_settings.groq_api_key = "test-groq-key"
        mock_settings.gemini_api_key = "test-gemini-key"
        mock_get_settings.return_value = mock_settings

        # Mock Groq to fail
        mock_groq_client = MagicMock()
        mock_groq_class.return_value = mock_groq_client
        mock_groq_client.chat.completions.create.side_effect = Exception("Groq error")

        # Mock Gemini client response
        mock_gemini_client = MagicMock()
        mock_genai.Client.return_value = mock_gemini_client
        mock_gemini_response = MagicMock()
        mock_gemini_response.text = "Gemini fallback response"
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response

        # Instantiate service and call generate
        service = LLMService()
        result = service.generate("Test prompt")

        self.assertEqual(result, "Gemini fallback response")
        mock_groq_client.chat.completions.create.assert_called_once()
        mock_gemini_client.models.generate_content.assert_called_once()

    @patch("app.services.llm_groq.get_settings")
    def test_no_keys_configured(self, mock_get_settings):
        # Setup settings with no keys
        mock_settings = MagicMock()
        mock_settings.groq_api_key = None
        mock_settings.gemini_api_key = None
        mock_get_settings.return_value = mock_settings

        service = LLMService()
        with self.assertRaises(RuntimeError) as context:
            service.generate("Test prompt")
        self.assertIn("No LLM services are configured", str(context.exception))


if __name__ == "__main__":
    unittest.main()

