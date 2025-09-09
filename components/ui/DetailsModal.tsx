// /components/ui/DetailsModal.tsx
import { Submission, Student, Question } from "@/types";

interface DetailsModalProps {
    submission: Submission | null;
    student: Student;
    questions: Record<string, Question>;
    onClose: () => void;
}

export default function DetailsModal({ submission, student, questions, onClose }: DetailsModalProps) {
    if (!submission) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col transform animate-scale-up">
                <header className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-800">{student?.studentName || '학생'} - 학습 상세 결과</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-800 text-3xl font-light">&times;</button>
                </header>
                <div className="p-6 overflow-y-auto space-y-4">
                    {submission.questionIds.map((qId: string, index: number) => {
                        const question = questions[qId];
                        if (!question) return (
                            <div key={index} className="p-4 rounded-lg bg-slate-100 text-sm text-slate-500">
                                문제 정보를 불러오는 중... (ID: {qId})
                            </div>
                        );
                        
                        const userAnswerIndex = submission.answers[index];
                        const isCorrect = question.answerIndex === userAnswerIndex;
                        const bgColor = isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';

                        return (
                            <div key={qId} className={`p-4 rounded-lg border ${bgColor}`}>
                                <p className="font-bold text-slate-800 whitespace-pre-wrap">{index + 1}. {question.questionText}</p>
                                <ul className="mt-3 space-y-1.5 text-sm">
                                    {question.choices.map((choice: string, choiceIndex: number) => {
                                        const isCorrectAnswer = question.answerIndex === choiceIndex;
                                        const isUserChoice = userAnswerIndex === choiceIndex;
                                        
                                        let choiceStyle = 'text-slate-600';
                                        if (isCorrectAnswer) choiceStyle = 'font-bold text-green-700';
                                        if (isUserChoice && !isCorrect) choiceStyle = 'text-red-700 line-through';

                                        return (
                                           <li key={choiceIndex} className={choiceStyle}>
                                               <span className={`inline-block w-4 mr-2`}>{choiceIndex + 1}.</span>{choice}
                                           </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )
                    })}
                </div>
                 <footer className="p-4 bg-slate-50 border-t text-right">
                    <button onClick={onClose} className="btn-secondary">닫기</button>
                </footer>
            </div>
        </div>
    );
}
