document.addEventListener('DOMContentLoaded', function() {
    // 导出按钮点击事件
    document.getElementById('export-btn').addEventListener('click', exportToExcel);
    document.getElementById('export-pdf-btn').addEventListener('click', exportToPDF);
    document.getElementById('reset-btn').addEventListener('click', resetSchedule);
    document.getElementById('save-btn').addEventListener('click', saveSchedule);

    // 导出为PDF功能
    async function exportToPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'pt', 'a4');
        const container = document.querySelector('.container');

        // 使用html2canvas将页面转换为图片
        const canvas = await html2canvas(container, {
            scale: 2, // 提高清晰度
            useCORS: true,
            logging: false
        });

        // 获取图片尺寸
        const imgWidth = doc.internal.pageSize.getWidth();
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        // 将图片添加到PDF
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        doc.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);

        // 如果内容超过一页，添加新页面
        let heightLeft = imgHeight;
        let position = 0;
        while (heightLeft >= doc.internal.pageSize.getHeight()) {
            position = heightLeft - doc.internal.pageSize.getHeight();
            doc.addPage();
            doc.addImage(imgData, 'JPEG', 0, -position, imgWidth, imgHeight);
            heightLeft -= doc.internal.pageSize.getHeight();
        }

        // 下载PDF文件
        doc.save(`排班表_${currentYear}年${currentMonth + 1}月.pdf`);
    }
    
    // 恢复默认排班
    function resetSchedule() {
        // 清除本地存储的排班数据
        localStorage.removeItem('savedSchedule_' + currentYear);
        localStorage.removeItem('savedGlobalPatternIndex');
        localStorage.removeItem('savedDisplayNames');
        
        // 重置全局模式索引为0（确保跟初始加载时一致）
        globalPatternIndex = 0;
        
        // 重置人员名字为默认值
        displayNames = {
            'A': 'A',
            'B': 'B',
            'C': 'C',
            'D': 'D'
        };
        
        // 更新人员名字输入框
        for (const person of staff) {
            const input = document.getElementById(`staff-${person.toLowerCase()}`);
            if (input) {
                input.value = displayNames[person];
            }
        }
        
        // 使用完全相同的方式重新计算全年排班
        yearlyScheduleData = {};
        for (let month = 0; month < 12; month++) {
            yearlyScheduleData[month] = generateSchedule(currentYear, month);
        }
        
        // 更新显示
        generateCalendar(currentYear, currentMonth);
        displaySchedule(yearlyScheduleData[currentMonth]);
        generateStatistics(yearlyScheduleData[currentMonth]);
        
        alert('已恢复默认排班！');
    }
    
    // 保存排班到本地存储
    function saveSchedule() {
        try {
            // 保存当前年份的所有排班数据
            localStorage.setItem('savedSchedule_' + currentYear, JSON.stringify(yearlyScheduleData));
            localStorage.setItem('savedGlobalPatternIndex', globalPatternIndex.toString());
            localStorage.setItem('savedDisplayNames', JSON.stringify(displayNames));
            
            alert('排班表已保存！');
        } catch (e) {
            alert('保存失败，可能是存储空间不足：' + e.message);
        }
    }
    
    // 从本地存储加载排班
    function loadSavedSchedule(year) {
        try {
            const savedSchedule = localStorage.getItem('savedSchedule_' + year);
            const savedPatternIndex = localStorage.getItem('savedGlobalPatternIndex');
            const savedDisplayNames = localStorage.getItem('savedDisplayNames');
            
            let hasData = false;
            
            if (savedSchedule) {
                yearlyScheduleData = JSON.parse(savedSchedule);
                hasData = true;
            }
            
            if (savedPatternIndex) {
                globalPatternIndex = parseInt(savedPatternIndex);
                hasData = true;
            }
            
            if (savedDisplayNames) {
                const parsedNames = JSON.parse(savedDisplayNames);
                // 更新显示名称
                for (const person in parsedNames) {
                    displayNames[person] = parsedNames[person];
                }
                
                // 更新输入框
                for (const person of staff) {
                    const input = document.getElementById(`staff-${person.toLowerCase()}`);
                    if (input && displayNames[person]) {
                        input.value = displayNames[person];
                    }
                }
                
                hasData = true;
            }
            
            return savedSchedule ? true : false; // 只有当排班数据存在时才返回true
        } catch (e) {
            console.error('加载保存的排班出错：', e);
            return false;
        }
    }
    
    // 导出为Excel功能
    function exportToExcel() {
        // 创建工作簿
        const wb = XLSX.utils.book_new();
        
        // 准备数据
        const data = [];
        
        // 添加表头
        data.push(['日期', displayNames['A'], displayNames['B'], displayNames['C'], displayNames['D']]);
        
        // 获取当月天数
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        
        // 获取当前月份的排班数据
        const currentMonthSchedule = yearlyScheduleData[currentMonth];
        
        // 收集每天的排班数据
        for (let day = 1; day <= daysInMonth; day++) {
            const row = [`${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`];
            
            // 添加每个人的排班情况
            for (const person of staff) {
                let status = '';
                if (currentMonthSchedule[person].restDays.includes(day)) {
                    status = '休';
                } else if (currentMonthSchedule[person].morningShifts.includes(day)) {
                    status = '早班';
                } else if (currentMonthSchedule[person].eveningShifts.includes(day)) {
                    status = '晚班';
                }
                row.push(status);
            }
            
            data.push(row);
        }
        
        // 创建工作表
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // 添加工作表到工作簿
        XLSX.utils.book_append_sheet(wb, ws, '排班表');
        
        // 导出文件
        XLSX.writeFile(wb, `排班表_${currentYear}年${currentMonth + 1}月.xlsx`);
    }

    // 获取当前日期
    let currentDate = new Date();
    let currentYear = currentDate.getFullYear();
    let currentMonth = currentDate.getMonth();
    
    // 获取年月选择器
    const yearSelect = document.getElementById('year-select');
    const monthSelect = document.getElementById('month-select');
    
    // 设置默认选中值
    yearSelect.value = currentYear;
    monthSelect.value = currentMonth;
    
    // 全年排班数据
    let yearlyScheduleData = {};
    
    // 初始化全局排班模式索引
    let globalPatternIndex = 0;
    
    // 人员列表和显示名字
    const staff = ['A', 'B', 'C', 'D'];
    let displayNames = {
        'A': 'A',
        'B': 'B',
        'C': 'C',
        'D': 'D'
    };
    
    // 添加年月选择器事件监听
    yearSelect.addEventListener('change', updateCalendar);
    monthSelect.addEventListener('change', updateCalendar);
    
    // 初始化时尝试加载保存的名字
    loadSavedSchedule(currentYear);
    
    function updateCalendar() {
        const newYear = parseInt(yearSelect.value);
        const newMonth = parseInt(monthSelect.value);
        
        // 如果年份变化，需要重新计算或加载排班
        if (newYear !== currentYear) {
            currentYear = newYear;
            
            // 先尝试从本地存储加载排班
            const hasSavedSchedule = loadSavedSchedule(currentYear);
            
            // 如果没有保存的排班数据，重新生成
            if (!hasSavedSchedule) {
                // 重置全局模式索引
                globalPatternIndex = 0;
                
                // 重新计算全年排班
                yearlyScheduleData = {};
                for (let month = 0; month < 12; month++) {
                    yearlyScheduleData[month] = generateSchedule(currentYear, month);
                }
            }
        }
        
        currentMonth = newMonth;
        currentDate = new Date(currentYear, currentMonth, 1);
        
        // 重新生成日历
        generateCalendar(currentYear, currentMonth);
        
        // 显示排班表
        displaySchedule(yearlyScheduleData[currentMonth]);
        
        // 生成统计信息
        generateStatistics(yearlyScheduleData[currentMonth]);
    }
    
    // 生成日历
    function generateCalendar(year, month) {
        const monthHeader = document.getElementById('month-header');
        const calendarDays = document.getElementById('calendar-days');
        
        // 设置月份标题
        const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
        monthHeader.textContent = `${year}年${monthNames[month]}`;
        
        // 清空日历
        calendarDays.innerHTML = '';
        
        // 获取当月第一天
        const firstDay = new Date(year, month, 1);
        
        // 获取当月最后一天
        const lastDay = new Date(year, month + 1, 0);
        
        // 获取当月第一天是星期几（0-6，0表示星期日）
        const firstDayOfWeek = firstDay.getDay();
        
        // 获取当月天数
        const daysInMonth = lastDay.getDate();
        
        // 添加上个月的占位日期
        for (let i = 0; i < firstDayOfWeek; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'day';
            calendarDays.appendChild(emptyDay);
        }
        
        // 添加当月的日期
        for (let day = 1; day <= daysInMonth; day++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'day';
            
            // 判断是否是周末
            const date = new Date(year, month, day);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            
            // 判断是否是特殊日期
            const isSpecialDay = specialDates.includes(day);
            
            if (isWeekend) {
                dayElement.classList.add('weekend');
            }
            
            if (isSpecialDay) {
                dayElement.classList.add('special-day');
            }
            
            const dayNumber = document.createElement('div');
            dayNumber.className = 'day-number';
            dayNumber.textContent = day;
            dayElement.appendChild(dayNumber);
            
            calendarDays.appendChild(dayElement);
        }
    }
    
    /**
     * 生成排班表
     * @param {number} year - 年份
     * @param {number} month - 月份（0-11）
     * @returns {Object} - 排班表
     */
    function generateSchedule(year, month) {
        // 获取当月天数
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // 初始化排班表
        const schedule = {};
        for (const person of staff) {
            schedule[person] = {
                workDays: [],
                restDays: [],
                morningShifts: [],
                eveningShifts: [],
                restDaysCount: 0   // 记录已休息天数
            };
        }

        // 定义休息模式
        // 0: AB休息, 1: AB休息, 2: CD休息, 3: CD休息
        let restPatternIndex = 0;
        
        // 使用全局模式索引，不重置
        // 为每一天分配人员
        for (let day = 1; day <= daysInMonth; day++) {
            // 判断是否是特殊日期（周末或8号、10号、15号）
            const date = new Date(year, month, day);
            const dayOfWeek = date.getDay(); // 0-6，0表示星期日
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isSpecialDay = specialDates.includes(day);
            const isRestrictedDay = isWeekend || isSpecialDay;
            
            // 根据当前模式确定基础早晚班
            let morningPairs = [];
            let eveningPairs = [];
            
            // 确定哪些人休息
            let restingPeople = [];
            
            // 如果不是特殊日期，执行休息逻辑
            if (!isRestrictedDay) {
                // 确定当前休息模式下应该休息的人
                if (restPatternIndex % 4 < 2) { // AB休息
                    // 检查A和B是否已达到休息天数上限
                    if (schedule['A'].restDaysCount < 8) {
                        restingPeople.push('A');
                    }
                    if (schedule['B'].restDaysCount < 8) {
                        restingPeople.push('B');
                    }
                } else { // CD休息
                    // 检查C和D是否已达到休息天数上限
                    if (schedule['C'].restDaysCount < 8) {
                        restingPeople.push('C');
                    }
                    if (schedule['D'].restDaysCount < 8) {
                        restingPeople.push('D');
                    }
                }
                
                // 进入下一个休息模式
                restPatternIndex = (restPatternIndex + 1) % 4;
            }
            
            // 确定工作的人
            const workingPeople = staff.filter(person => !restingPeople.includes(person));
            
            // 如果有人休息，需要调整排班
            if (restingPeople.length > 0) {
                // 根据全局排班模式决定工作的人如何分配早晚班
                if (globalPatternIndex % 4 < 2) { // A早B晚C早D晚模式
                    // 优先保持原有模式
                    morningPairs = workingPeople.filter(p => ['A', 'C'].includes(p));
                    eveningPairs = workingPeople.filter(p => ['B', 'D'].includes(p));
                } else { // A晚B早C晚D早模式
                    morningPairs = workingPeople.filter(p => ['B', 'D'].includes(p));
                    eveningPairs = workingPeople.filter(p => ['A', 'C'].includes(p));
                }
                
                // 确保早晚班都有人
                if (morningPairs.length === 0 && eveningPairs.length >= 2) {
                    morningPairs = [eveningPairs[0]];
                    eveningPairs = eveningPairs.slice(1);
                } else if (eveningPairs.length === 0 && morningPairs.length >= 2) {
                    eveningPairs = [morningPairs[0]];
                    morningPairs = morningPairs.slice(1);
                }
            } else {
                // 没有人休息，按正常的全局模式排班
                if (globalPatternIndex % 4 < 2) { // A早B晚C早D晚模式
                    if (globalPatternIndex % 2 === 0) { // 第1天
                        morningPairs = ['A', 'C'];
                        eveningPairs = ['B', 'D'];
                    } else { // 第2天
                        morningPairs = ['A', 'C'];
                        eveningPairs = ['B', 'D'];
                    }
                } else { // A晚B早C晚D早模式
                    if (globalPatternIndex % 2 === 0) { // 第3天
                        morningPairs = ['B', 'D'];
                        eveningPairs = ['A', 'C'];
                    } else { // 第4天
                        morningPairs = ['B', 'D'];
                        eveningPairs = ['A', 'C'];
                    }
                }
            }
            
            // 记录工作和休息
            for (const person of staff) {
                if (restingPeople.includes(person)) {
                    // 记录休息
                    schedule[person].restDays.push(day);
                    schedule[person].restDaysCount += 1;
                } else {
                    // 记录工作
                    schedule[person].workDays.push(day);
                    
                    // 记录早晚班
                    if (morningPairs.includes(person)) {
                        schedule[person].morningShifts.push(day);
                    } else {
                        schedule[person].eveningShifts.push(day);
                    }
                }
            }
            
            // 更新全局模式索引
            globalPatternIndex = (globalPatternIndex + 1) % 4;
        }
        
        return schedule;
    }
    
    /**
     * 显示排班表
     * @param {Object} schedule - 排班表
     */
    function displaySchedule(schedule) {
        const days = document.querySelectorAll('.day');
        
        // 跳过空白的占位日期
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        
        // 遍历每一天
        for (let i = 0; i < days.length; i++) {
            const dayElement = days[i];
            
            // 跳过空白的占位日期
            if (i < firstDay) continue;
            
            const day = i - firstDay + 1;
            
            // 检查是否是法定节假日或补班日
            const isHoliday = holidays.holidays?.[currentMonth] && holidays.holidays[currentMonth].includes(day);
            const isWorkday = holidays.workdays?.[currentMonth] && holidays.workdays[currentMonth].includes(day);
            
            // 检查是否是特殊日期
            const isSpecialDay = specialDates.includes(day);
            
            if (isSpecialDay) {
                dayElement.classList.add('special-day');
                const specialMarker = document.createElement('div');
                specialMarker.className = 'holiday-marker';
                specialMarker.textContent = '特殊';
                dayElement.querySelector('.day-number').appendChild(specialMarker);
            }
            
            if (isHoliday) {
                dayElement.classList.add('holiday');
                
                // 添加节假日标记
                const holidayMarker = document.createElement('div');
                holidayMarker.className = 'holiday-marker';
                holidayMarker.textContent = '节假日';
                dayElement.querySelector('.day-number').appendChild(holidayMarker);
            } else if (isWorkday) {
                dayElement.classList.add('workday');
                
                // 添加补班日标记（使用与节假日相同的样式）
                const workdayMarker = document.createElement('div');
                workdayMarker.className = 'holiday-marker';
                workdayMarker.textContent = '补班';
                dayElement.querySelector('.day-number').appendChild(workdayMarker);
            }
            
            // 为每个人添加状态
            for (const person of staff) {
                const isResting = schedule[person].restDays.includes(day);
                const isMorningShift = schedule[person].morningShifts.includes(day);
                const isEveningShift = schedule[person].eveningShifts.includes(day);
                
                const staffElement = document.createElement('div');
                staffElement.className = `staff staff-${person.toLowerCase()}`;
                staffElement.textContent = displayNames[person];
                staffElement.dataset.person = person;
                staffElement.dataset.day = day;
                staffElement.dataset.month = currentMonth;
                
                if (isResting) {
                    staffElement.classList.add('rest');
                    staffElement.textContent += ' (休)';
                } else if (isMorningShift) {
                    staffElement.classList.add('morning');
                    staffElement.textContent += ' (早)';
                } else if (isEveningShift) {
                    staffElement.classList.add('evening');
                    staffElement.textContent += ' (晚)';
                }
                
                // 添加点击事件
                staffElement.addEventListener('click', function() {
                    // 获取当前状态
                    const isResting = this.classList.contains('rest');
                    const isMorning = this.classList.contains('morning');
                    const isEvening = this.classList.contains('evening');
                    
                    // 清除所有状态类
                    this.classList.remove('rest', 'morning', 'evening');
                    
                    // 切换状态
                    if (isResting) {
                        this.classList.add('morning');
                        this.textContent = displayNames[this.dataset.person] + ' (早)';
                        updateSchedule(this.dataset.person, parseInt(this.dataset.month), parseInt(this.dataset.day), 'morning');
                    } else if (isMorning) {
                        this.classList.add('evening');
                        this.textContent = displayNames[this.dataset.person] + ' (晚)';
                        updateSchedule(this.dataset.person, parseInt(this.dataset.month), parseInt(this.dataset.day), 'evening');
                    } else {
                        this.classList.add('rest');
                        this.textContent = displayNames[this.dataset.person] + ' (休)';
                        updateSchedule(this.dataset.person, parseInt(this.dataset.month), parseInt(this.dataset.day), 'rest');
                    }
                });
                
                dayElement.appendChild(staffElement);
            }
        }
    }
    
    /**
     * 更新排班数据
     * @param {string} person - 人员
     * @param {number} month - 月份
     * @param {number} day - 日期
     * @param {string} newStatus - 新状态（'rest'/'morning'/'evening'）
     */
    function updateSchedule(person, month, day, newStatus) {
        // 确保使用正确的月份数据
        const monthSchedule = yearlyScheduleData[month];
        if (!monthSchedule) return;

        // 从原状态中移除
        const personSchedule = monthSchedule[person];
        personSchedule.workDays = personSchedule.workDays.filter(d => d !== day);
        personSchedule.restDays = personSchedule.restDays.filter(d => d !== day);
        personSchedule.morningShifts = personSchedule.morningShifts.filter(d => d !== day);
        personSchedule.eveningShifts = personSchedule.eveningShifts.filter(d => d !== day);
        
        // 添加到新状态
        if (newStatus === 'rest') {
            personSchedule.restDays.push(day);
        } else {
            personSchedule.workDays.push(day);
            if (newStatus === 'morning') {
                personSchedule.morningShifts.push(day);
            } else {
                personSchedule.eveningShifts.push(day);
            }
        }
        
        // 更新统计信息
        generateStatistics(monthSchedule);
    }
    
    /**
     * 生成统计信息
     * @param {Object} schedule - 排班表
     */
    function generateStatistics(schedule) {
        const statisticsElement = document.getElementById('statistics');
        
        // 清空统计信息
        statisticsElement.innerHTML = '<h2>排班统计</h2>';
        
        // 为每个人生成统计信息
        for (const person of staff) {
            const staffStats = document.createElement('div');
            staffStats.className = 'staff-stats';
            
            const staffName = document.createElement('div');
            staffName.className = 'staff-name';
            staffName.textContent = `${displayNames[person]} 的排班情况：`;
            staffStats.appendChild(staffName);
            
            // 工作日期
            const workDays = document.createElement('div');
            workDays.className = 'date-list';
            const sortedWorkDays = [...schedule[person].workDays].sort((a, b) => a - b);
            workDays.textContent = `工作日期：${sortedWorkDays.join(', ')} (共 ${schedule[person].workDays.length} 天)`;
            staffStats.appendChild(workDays);
            
            // 休息日期
            const restDays = document.createElement('div');
            restDays.className = 'date-list';
            const sortedRestDays = [...schedule[person].restDays].sort((a, b) => a - b);
            restDays.textContent = `休息日期：${sortedRestDays.join(', ')} (共 ${schedule[person].restDays.length} 天)`;
            staffStats.appendChild(restDays);
            
            // 早班日期
            const morningShifts = document.createElement('div');
            morningShifts.className = 'date-list';
            const sortedMorningShifts = [...schedule[person].morningShifts].sort((a, b) => a - b);
            morningShifts.textContent = `早班日期：${sortedMorningShifts.join(', ')} (共 ${schedule[person].morningShifts.length} 天)`;
            staffStats.appendChild(morningShifts);
            
            // 晚班日期
            const eveningShifts = document.createElement('div');
            eveningShifts.className = 'date-list';
            const sortedEveningShifts = [...schedule[person].eveningShifts].sort((a, b) => a - b);
            eveningShifts.textContent = `晚班日期：${sortedEveningShifts.join(', ')} (共 ${schedule[person].eveningShifts.length} 天)`;
            staffStats.appendChild(eveningShifts);
            
            statisticsElement.appendChild(staffStats);
        }
    }

    // 初始化人员名字输入框
    function initStaffNameInputs() {
        for (const person of staff) {
            const input = document.getElementById(`staff-${person.toLowerCase()}`);
            input.value = displayNames[person];
            input.addEventListener('input', function() {
                displayNames[person] = this.value || person;
                // 重新显示排班表以更新显示的名字
                generateCalendar(currentYear, currentMonth);
                displaySchedule(yearlyScheduleData[currentMonth]);
                generateStatistics(yearlyScheduleData[currentMonth]);
            });
        }
    }
    
    // 特殊日期（需要全员值班的日期）
    const specialDates = [8, 10, 15];
    
    // 从聚合数据API获取中国法定节假日数据
    let holidays = {};
    
    // 调用聚合数据API获取节假日信息
    async function fetchHolidays() {
        try {
            const response = await fetch(`https://timor.tech/api/holiday/year/2025`);
            const data = await response.json();
            
            if (data.holiday) {
                // 处理API返回的节假日数据
                const holidayData = data.holiday;
                const processedHolidays = {
                    holidays: {},
                    workdays: {}
                };
                
                Object.values(holidayData).forEach(holiday => {
                    // 解析YYYY-MM-DD格式的日期
                    const dateStr = holiday.date;
                    const [year, month, day] = dateStr.split('-').map(num => parseInt(num));
                    const monthIndex = month - 1; // 月份转为0-11
                    
                    if (holiday.holiday) {
                        // 节假日
                        if (!processedHolidays.holidays[monthIndex]) {
                            processedHolidays.holidays[monthIndex] = [];
                        }
                        processedHolidays.holidays[monthIndex].push(parseInt(day));
                    } else {
                        // 补班日
                        if (!processedHolidays.workdays[monthIndex]) {
                            processedHolidays.workdays[monthIndex] = [];
                        }
                        processedHolidays.workdays[monthIndex].push(parseInt(day));
                    }
                });
                
                holidays = processedHolidays;
                
                // 更新界面
                generateCalendar(currentYear, currentMonth);
                displaySchedule(yearlyScheduleData[currentMonth]);
                generateStatistics(yearlyScheduleData[currentMonth]);
            } else {
                console.error('获取节假日数据失败:', data.reason);
            }
        } catch (error) {
            console.error('获取节假日数据时出错:', error);
        }
    }
    
    // 页面初始化函数
    function initializeApp() {
        // 重置全局变量，确保初始状态一致
        globalPatternIndex = 0;
        
        // 先加载保存的数据（名字和排班）
        const hasSavedSchedule = loadSavedSchedule(currentYear);
        
        // 初始化人员名字输入框事件监听
        initStaffNameInputs();
        
        // 如果没有保存的排班，使用与resetSchedule完全相同的逻辑计算排班
        if (!hasSavedSchedule) {
            yearlyScheduleData = {};
            for (let month = 0; month < 12; month++) {
                yearlyScheduleData[month] = generateSchedule(currentYear, month);
            }
        }
        
        // 生成日历
        generateCalendar(currentYear, currentMonth);
        
        // 显示排班表
        displaySchedule(yearlyScheduleData[currentMonth]);
        
        // 生成统计信息
        generateStatistics(yearlyScheduleData[currentMonth]);
        
        // 获取节假日数据
        fetchHolidays();
    }
    
    // 初始化应用
    initializeApp();
});