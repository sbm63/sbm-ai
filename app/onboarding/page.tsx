'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';

const questions = [
  'Tell us about your background.',
  'Why are you interested in this role?',
  'Describe a challenging project you led.',
];

type QA = { question: string; answer: string };

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role') || '';
  const candidateId = searchParams.get('candidateId') || '';

  const formattedRole = roleParam
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const [currentQ, setCurrentQ] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [audioActive, setAudioActive] = useState(false);
  const [transcript, setTranscript] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioActiveRef = useRef(false);

  // 1️⃣ Properly initialize with each question baked in
  const qaRef = useRef<QA[]>(
    questions.map((q) => ({ question: q, answer: '' })),
  );

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

    return () => {
      recognitionRef.current?.stop();
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach((t) => t.stop());
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

  // 2️⃣ Send the full QA array every time
  const persistAnswer = async (qIdx: number, answer: string) => {
    qaRef.current[qIdx].answer = answer.trim();

    await fetch('/api/save-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidateId,
        userResponse: qaRef.current,
      }),
    });
  };

  const evaluateInterview = async () => {
    router.push(`/onboarding/report?candidateId=${candidateId}`);
  };

  const handleNext = async () => {
    if (audioActive) stopListening();
    await persistAnswer(currentQ, transcript);
    setTranscript('');

    if (currentQ < questions.length - 1) {
      setCurrentQ((q) => q + 1);
    } else {
      await evaluateInterview();
    }
  };
  const handlePrevious = async () => {
    if (audioActive) stopListening();
    await persistAnswer(currentQ, transcript);

    if (currentQ > 0) {
      const prev = currentQ - 1;
      setTranscript(qaRef.current[prev].answer);
      setCurrentQ(prev);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 max-w-4xl mx-auto">
      <div className="max-w-xl mx-auto mt-12 text-center space-y-6 p-6 bg-white rounded-lg shadow">
        {formattedRole && (
          <h2 className="text-xl font-semibold text-gray-700">
            {formattedRole} Interview
          </h2>
        )}

        <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden mx-auto">
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

        <div className="flex justify-center gap-6">
          <button
            onClick={cameraActive ? stopCamera : startCamera}
            className="p-3 rounded-full bg-gray-100 hover:bg-gray-200"
            aria-label={cameraActive ? 'Stop Camera' : 'Start Camera'}
          >
            {!cameraActive ? <VideoOff size={24} /> : <Video size={24} />}
          </button>
          <button
            onClick={audioActive ? stopListening : startListening}
            className="p-3 rounded-full bg-gray-100 hover:bg-gray-200"
            aria-label={audioActive ? 'Stop Listening' : 'Start Listening'}
          >
            {!audioActive ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
        </div>

        <h1 className="text-2xl font-bold">
          Question {currentQ + 1} of {questions.length}
        </h1>
        <p className="text-lg">{questions[currentQ]}</p>

        <div className="flex justify-between gap-4 mt-4">
          <button
            onClick={handlePrevious}
            disabled={currentQ === 0}
            className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded font-medium transition ${
              currentQ === 0
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                : 'bg-gray-200 text-black hover:bg-gray-300'
            }`}
          >
            <ArrowLeft size={20} />
            Previous
          </button>

          <button
            onClick={handleNext}
            disabled={audioActive}
            className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded font-medium transition ${
              audioActive
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                : 'bg-blue-700 text-white hover:bg-blue-600'
            }`}
          >
            {currentQ < questions.length - 1 ? 'Next Question' : 'Finish'}
            <ArrowRight size={20} />
          </button>
        </div>

        <div className="text-left">
          <h2 className="font-semibold mb-2">Transcript:</h2>
          <textarea
            value={transcript}
            readOnly
            rows={4}
            className="w-full border rounded p-2"
          />
        </div>
      </div>
    </div>
  );
}
