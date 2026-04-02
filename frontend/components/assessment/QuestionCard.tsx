interface QuestionCardProps {
  question: {
    key: string;
    text: string;
    options: { label: string; value: number | string | boolean }[];
  };
  questionNumber: number;
  onAnswer: (key: string, value: number | string | boolean) => void;
  selectedValue?: number | string | boolean;
}

export default function QuestionCard({ question, questionNumber, onAnswer, selectedValue }: QuestionCardProps) {
  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-lg mx-auto">
      <div className="card-body gap-6 p-6 sm:p-8">
        <h2 className="text-2xl font-semibold text-base-content leading-relaxed">
          {question.text}
        </h2>

        <div className="flex flex-col gap-3 mt-4">
          {question.options.map((option) => (
            <button
              key={String(option.value)}
              className={`btn btn-lg justify-start text-left normal-case border-2 ${
                selectedValue === option.value
                  ? "btn-primary border-primary shadow-md"
                  : "btn-outline border-base-300 hover:border-primary/50 text-base-content"
              }`}
              onClick={() => onAnswer(question.key, option.value)}
            >
              <span className="text-lg">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
