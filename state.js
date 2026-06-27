export const state = {
    user: null,
    userProfile: null,
    view: 'loading',
    activeGroupId: null,
    groups: [],
    currentQuiz: null,
    quizAnswers: {}, 
    chatFilter: 'all', // 'all', 'doubts', 'solved'
    replyingToDoubt: null,
    messages: [], // Stores current group messages
    performanceData: null, // Cache for admin analytics
    currentPerfView: 'table', // 'table', 'charts', 'insights'
    listeners: {
        groups: null,
        chat: null,
        notes: null
    },
    studyTimer: {
        intervalId: null,
        timeLeft: 0,
        isStudying: false
    }
};

window.adminCharts = [];
export const clearAdminCharts = () => {
    window.adminCharts.forEach(chart => chart.destroy());
    window.adminCharts = [];
};