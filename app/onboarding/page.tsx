'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  ArrowRight,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

type QA = {
  question: string;
  answer: string;
  evaluation?: {
    score: number;
    feedback: string;
    strengths: string[];
    improvements: string[];
  };
};

type InterviewProgress = {
  currentCount: number;
  maxQuestions: number;
  overallScore: number;
};

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const roleParam = (searchParams.get('role') || '').trim();
  const jobIdParam = (
    searchParams.get('id') ||
    searchParams.get('jobId') ||
    ''
  ).trim();
  const candidateId = (searchParams.get('candidateId') || '').trim();

  const formattedRole = roleParam
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  // AI Interview State
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [qError, setQError] = useState<string>('');

  // UI State
  const [cameraActive, setCameraActive] = useState(false);
  const [audioActive, setAudioActive] = useState(false);
  const [transcript, setTranscript] = useState('');

  // Progress tracking
  const [questionHistory, setQuestionHistory] = useState<QA[]>([]);
  const [progress, setProgress] = useState<InterviewProgress>({
    currentCount: 0,
    maxQuestions: 8,
    overallScore: 0,
  });
  const [lastEvaluation, setLastEvaluation] = useState<any>(null);

  // Question selection
  const [aiSuggestedQuestion, setAiSuggestedQuestion] = useState<string>('');
  const [customQuestions, setCustomQuestions] = useState<any[]>([]);
  const [showQuestionSelection, setShowQuestionSelection] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioActiveRef = useRef(false);

  // Start AI Interview
  const startInterview = useCallback(async () => {
    try {
      setLoadingQuestion(true);
      setQError('');

      const response = await fetch('/api/interviews/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          jobProfileId: jobIdParam,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start interview');
      }

      const data = await response.json();
      setCurrentQuestion(data.initialQuestion);
      setCustomQuestions(data.customQuestions || []);
      setProgress((prev) => ({ ...prev, maxQuestions: data.maxQuestions }));
      setInterviewStarted(true);
    } catch (error: any) {
      setQError(error.message || 'Failed to start interview');
    } finally {
      setLoadingQuestion(false);
    }
  }, [candidateId, jobIdParam]);

  // Auto-start interview when component loads
  useEffect(() => {
    if (candidateId && jobIdParam && !interviewStarted && !loadingQuestion) {
      startInterview();
    }
  }, [
    candidateId,
    jobIdParam,
    interviewStarted,
    loadingQuestion,
    startInterview,
  ]);

  // Speech-to-text + camera setup
  useEffect(() => {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;

    const recog = new SpeechRecognitionClass();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'en-US';
    recog.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        interim += event.results[i][0].transcript;
      }
      setTranscript(interim);
    };
    recog.onend = () => {
      if (audioActiveRef.current) recog.start();
    };

    recognitionRef.current = recog;

    // Capture video ref at effect creation time
    const videoElement = videoRef.current;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      // Clean up video stream on unmount
      if (videoElement && videoElement.srcObject) {
        const stream = videoElement.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      alert('Unable to access camera.');
    }
  };
  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  };
  const startListening = () => {
    if (!recognitionRef.current) return;
    recognitionRef.current.start();
    audioActiveRef.current = true;
    setAudioActive(true);
  };
  const stopListening = () => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    audioActiveRef.current = false;
    setAudioActive(false);
  };

  // Submit answer and get next question
  const submitAnswer = async () => {
    if (!transcript.trim() || !currentQuestion) return;

    try {
      setEvaluating(true);
      if (audioActive) stopListening();

      const response = await fetch('/api/interviews/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          currentAnswer: transcript.trim(),
          currentQuestion,
          jobProfileId: jobIdParam,
          questionHistory,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to evaluate answer');
      }

      const data = await response.json();
      console.log('🔄 Interview evaluation response:', data);

      // Update progress and history
      const newQA: QA = {
        question: currentQuestion,
        answer: transcript.trim(),
        evaluation: data.evaluation,
      };

      setQuestionHistory((prev) => [...prev, newQA]);
      setProgress(data.progress);
      setLastEvaluation(data.evaluation);
      setTranscript('');

      if (data.interviewComplete || !data.shouldContinue) {
        setInterviewComplete(true);
        // Redirect to final results
        setTimeout(() => {
          router.push(`/onboarding/reports?candidateId=${candidateId}`);
        }, 3000);
      } else if (data.nextQuestion || data.customQuestions?.length > 0) {
        // Show question selection if we have both AI and custom questions
        setAiSuggestedQuestion(data.nextQuestion || '');
        setCustomQuestions(data.customQuestions || []);

        if (data.nextQuestion && data.customQuestions?.length > 0) {
          setShowQuestionSelection(true);
        } else if (data.nextQuestion) {
          setCurrentQuestion(data.nextQuestion);
        } else if (data.customQuestions?.length > 0) {
          setCurrentQuestion(data.customQuestions[0].question);
        }
      }
    } catch (error: any) {
      setQError(error.message || 'Failed to process answer');
    } finally {
      setEvaluating(false);
    }
  };

  // Select a question to proceed with
  const selectQuestion = (question: string) => {
    setCurrentQuestion(question);
    setShowQuestionSelection(false);
    setAiSuggestedQuestion('');
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 max-w-6xl mx-auto">
      {/* Left: Calling Section */}
      <div className="flex-1 bg-white rounded-lg shadow p-6 flex flex-col items-center">
        {(formattedRole || jobIdParam) && (
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            {formattedRole || 'Interview'}
          </h2>
        )}
        <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {!cameraActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <VideoOff size={48} className="text-gray-500" />
            </div>
          )}
        </div>
        <div className="flex justify-center gap-6 mt-4">
          <button
            onClick={cameraActive ? stopCamera : startCamera}
            className="p-3 rounded-full bg-gray-100 hover:bg-gray-200"
          >
            {!cameraActive ? <VideoOff size={24} /> : <Video size={24} />}
          </button>
          <button
            onClick={audioActive ? stopListening : startListening}
            className="p-3 rounded-full bg-gray-100 hover:bg-gray-200"
          >
            {!audioActive ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
        </div>
      </div>

      {/* Right: Question Section */}
      <div className="flex-1 bg-white rounded-lg shadow p-6 flex flex-col">
        {loadingQuestion ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-sm text-gray-500">
              Generating your first question...
            </p>
          </div>
        ) : qError ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600">{qError}</p>
            <button
              onClick={startInterview}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
            >
              Try Again
            </button>
          </div>
        ) : interviewComplete ? (
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Interview Complete!</h2>
            <p className="text-gray-600 mb-4">
              Thank you for your time. Redirecting to results...
            </p>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm">
                Final Score:{' '}
                <span className="font-bold text-blue-600">
                  {progress.overallScore}/10
                </span>
              </p>
              <p className="text-sm">
                Questions Answered: {progress.currentCount}/
                {progress.maxQuestions}
              </p>
            </div>
          </div>
        ) : showQuestionSelection ? (
          <>
            {/* Question Selection Interface */}
            <h1 className="text-2xl font-bold mb-4">Choose Next Question</h1>
            <p className="text-gray-600 mb-6">
              Select which question you&apos;d like to ask next:
            </p>

            <div className="space-y-4">
              {/* AI Suggested Question */}
              {aiSuggestedQuestion && (
                <div className="border-2 border-blue-200 rounded-lg p-4 hover:border-blue-400 transition-colors">
                  <div className="flex items-start space-x-3">
                    <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                      AI Suggested
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-800 font-medium mb-2">
                        {aiSuggestedQuestion}
                      </p>
                      <button
                        onClick={() => selectQuestion(aiSuggestedQuestion)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-500 transition"
                      >
                        Use This Question
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Custom Questions */}
              {customQuestions.map((q, idx) => (
                <div
                  key={idx}
                  className="border-2 border-green-200 rounded-lg p-4 hover:border-green-400 transition-colors"
                >
                  <div className="flex items-start space-x-3">
                    <div className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                      Custom
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-800 font-medium mb-2">
                        {q.question}
                      </p>
                      {q.expectedAnswer && (
                        <p className="text-gray-500 text-sm mb-2">
                          Expected: {q.expectedAnswer}
                        </p>
                      )}
                      <button
                        onClick={() => selectQuestion(q.question)}
                        className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-500 transition"
                      >
                        Use This Question
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : currentQuestion ? (
          <>
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>
                  Question {progress.currentCount + 1} of{' '}
                  {progress.maxQuestions}
                </span>
                <span>Overall Score: {progress.overallScore}/10</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      (progress.currentCount / progress.maxQuestions) * 100
                    }%`,
                  }}
                ></div>
              </div>
            </div>

            <h1 className="text-2xl font-bold mb-4">AI Interview Session</h1>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-lg text-blue-900">{currentQuestion}</p>
            </div>

            {/* Last Evaluation Feedback */}
            {lastEvaluation && (
              <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h3 className="font-semibold mb-2 flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  Previous Answer Feedback (Score: {lastEvaluation.score}/10)
                </h3>
                <p className="text-sm text-gray-700 mb-2">
                  {lastEvaluation.feedback}
                </p>
                {lastEvaluation.strengths?.length > 0 && (
                  <div className="text-xs">
                    <span className="text-green-600 font-medium">
                      Strengths:{' '}
                    </span>
                    {lastEvaluation.strengths.join(', ')}
                  </div>
                )}
              </div>
            )}

            {/* Answer Input */}
            <div className="mb-6">
              <h2 className="font-semibold mb-2">Your Answer:</h2>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={6}
                className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Type your answer here or use the microphone to speak..."
                disabled={evaluating}
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                onClick={submitAnswer}
                disabled={!transcript.trim() || evaluating || audioActive}
                className={`inline-flex items-center gap-2 px-8 py-3 rounded-lg font-medium transition ${
                  !transcript.trim() || evaluating || audioActive
                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    : 'bg-blue-700 text-white hover:bg-blue-600'
                }`}
              >
                {evaluating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                    Evaluating...
                  </>
                ) : (
                  <>
                    Submit Answer
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">Starting interview...</p>
          </div>
        )}
      </div>
    </div>
  );
}
