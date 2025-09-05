import { NextRequest, NextResponse } from 'next/server';
import { db } from '@vercel/postgres';
import { executeWithRetry } from '@/lib/db-retry';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const MAX_QUESTIONS = 8;

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

export async function POST(req: NextRequest) {
  try {
    const {
      candidateId,
      currentAnswer,
      currentQuestion,
      jobProfileId,
      questionHistory = [],
    } = await req.json();

    // Get job profile for context
    const { rows: jobRows } = await executeWithRetry(
      () => db.sql`
      SELECT 
        id, title, description, department, location, type, salary, questions,
        created_at AS "createdAt"
      FROM jobs 
      WHERE id = ${jobProfileId};
    `,
    );

    if (jobRows.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const jobProfile = jobRows[0];

    // Create current Q&A entry
    const currentQA: QA = {
      question: currentQuestion,
      answer: currentAnswer,
    };

    // Evaluate the current answer using AI
    const evaluationResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You are an expert interviewer evaluating candidates for the position: ${
            jobProfile.title
          }.
          
          Job Description: ${
            jobProfile.description || 'No specific description provided'
          }
          Department: ${jobProfile.department || 'Not specified'}
          Location: ${jobProfile.location || 'Not specified'}
          
          Evaluate the candidate's answer and provide structured feedback.
          
          Return ONLY valid JSON with this exact structure:
          {
            "score": 1-10,
            "feedback": "Detailed feedback on the answer",
            "strengths": ["List of strengths shown in the answer"],
            "improvements": ["Areas where the answer could be improved"],
            "isGoodAnswer": true/false
          }`,
        },
        {
          role: 'user',
          content: `Question: "${currentQuestion}"
          
          Candidate's Answer: "${currentAnswer}"
          
Please evaluate this answer considering the job requirements.`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const evaluationText =
      evaluationResponse.choices[0]?.message?.content || '{}';
    let evaluation;

    try {
      evaluation = JSON.parse(evaluationText);
      currentQA.evaluation = evaluation;
    } catch (e) {
      console.error('Failed to parse evaluation:', e);
      evaluation = {
        score: 5,
        feedback: 'Unable to evaluate',
        strengths: [],
        improvements: [],
      };
      currentQA.evaluation = evaluation;
    }

    // Update question history
    const updatedHistory = [...questionHistory, currentQA];
    const currentCount = updatedHistory.length;

    // Calculate overall score
    const overallScore =
      updatedHistory.reduce((acc, qa) => acc + (qa.evaluation?.score || 5), 0) /
      updatedHistory.length;

    // Determine if interview should continue - just based on question count for now
    const shouldContinue = currentCount < MAX_QUESTIONS;

    console.log(
      `📊 Interview Progress: ${currentCount}/${MAX_QUESTIONS}, shouldContinue: ${shouldContinue}, overallScore: ${overallScore.toFixed(
        1,
      )}`,
    );

    let nextQuestion = null;
    let customQuestions = [];

    if (shouldContinue) {
      // Get custom questions from job profile
      const customQs = jobProfile.questions || [];

      // Filter out already asked custom questions
      const askedQuestions = updatedHistory.map((qa) =>
        qa.question.toLowerCase(),
      );
      const availableCustomQuestions = customQs.filter(
        (q: any) => !askedQuestions.includes(q.question.toLowerCase()),
      );

      // Generate AI question based on conversation history
      const nextQuestionResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: `You are conducting a technical interview for the position: ${
              jobProfile.title
            }.
            
            Job Description: ${
              jobProfile.description || 'No specific description provided'
            }
            Department: ${jobProfile.department || 'Not specified'}
            
            Based on the conversation history, generate the next most appropriate interview question.
            The question should:
            - Build upon previous answers
            - Explore different aspects of the candidate's skills
            - Be relevant to the job requirements
            - Progress from general to more specific/technical
            
            Return ONLY a JSON object with this structure:
            {
              "question": "Your next interview question here",
              "reasoning": "Brief explanation of why this question is appropriate now"
            }`,
          },
          {
            role: 'user',
            content: `Conversation History:
${updatedHistory
  .map(
    (qa, idx) =>
      `Q${idx + 1}: ${qa.question}
A${idx + 1}: ${qa.answer}
Score: ${qa.evaluation?.score}/10
`,
  )
  .join('\n')}

Current Overall Score: ${overallScore.toFixed(1)}/10
Questions Asked: ${currentCount}/${MAX_QUESTIONS}

Generate the next appropriate question.`,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const nextQuestionText =
        nextQuestionResponse.choices[0]?.message?.content || '{}';

      let aiGeneratedQuestion = null;
      try {
        const nextQuestionData = JSON.parse(nextQuestionText);
        aiGeneratedQuestion = nextQuestionData.question;
      } catch (e) {
        console.error('Failed to parse next question:', e);
        aiGeneratedQuestion =
          "Tell me about a challenging project you've worked on recently.";
      }

      // Return both AI and custom questions for selection
      customQuestions = availableCustomQuestions;
      nextQuestion = aiGeneratedQuestion;
    }

    // Save the interview progress to database
    await executeWithRetry(
      () => db.sql`
      INSERT INTO interviews (candidate_id, responses)
      VALUES (
        ${candidateId},
        ${JSON.stringify(updatedHistory)}::jsonb
      )
      ON CONFLICT (candidate_id) DO UPDATE
      SET
        responses = EXCLUDED.responses,
        updated_at = now();
    `,
    );

    // Return evaluation and next steps
    return NextResponse.json({
      evaluation: currentQA.evaluation,
      nextQuestion, // AI-generated question
      customQuestions, // Available custom questions from job profile
      shouldContinue,
      progress: {
        currentCount,
        maxQuestions: MAX_QUESTIONS,
        overallScore: parseFloat(overallScore.toFixed(1)),
      },
      interviewComplete: !shouldContinue,
    });
  } catch (error) {
    console.error('[INTERVIEW_EVALUATION_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to evaluate interview response' },
      { status: 500 },
    );
  }
}
