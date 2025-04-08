document.addEventListener('DOMContentLoaded', function() {
    // 导出按钮点击事件
    document.getElementById('export-btn').addEventListener('click', exportToExcel);
    document.getElementById('export-pdf-btn').addEventListener('click', exportToPDF);

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
        
        // 收集每天的排班数据
        for (let day = 1; day <= daysInMonth; day++) {
            const row = [`${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`];
            
            // 添加每个人的排班情况
            for (const person of staff) {
                let status = '';
                if (schedule[person].restDays.includes(day)) {
                    status = '休';
                } else if (schedule[person].morningShifts.includes(day)) {
                    status = '早班';
                } else if (schedule[person].eveningShifts.includes(day)) {
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
    
    // 添加年月选择器事件监听
    yearSelect.addEventListener('change', updateCalendar);
    monthSelect.addEventListener('change', updateCalendar);
    
    function updateCalendar() {
        currentYear = parseInt(yearSelect.value);
        currentMonth = parseInt(monthSelect.value);
        currentDate = new Date(currentYear, currentMonth, 1);
        
        // 重新生成日历和排班表
        generateCalendar(currentYear, currentMonth);
        const schedule = generateSchedule(currentYear, currentMonth);
        displaySchedule(schedule);
        generateStatistics(schedule);
    }
    
    // 人员列表和显示名字
    const staff = ['A', 'B', 'C', 'D'];
    let displayNames = {
        'A': 'A',
        'B': 'B',
        'C': 'C',
        'D': 'D'
    };

    // 初始化人员名字输入框
    function initStaffNameInputs() {
        for (const person of staff) {
            const input = document.getElementById(`staff-${person.toLowerCase()}`);
            input.value = displayNames[person];
            input.addEventListener('input', function() {
                displayNames[person] = this.value || person;
                // 重新生成日历和排班表以更新显示的名字
                generateCalendar(currentYear, currentMonth);
                displaySchedule(schedule);
                generateStatistics(schedule);
            });
        }
    }
    
    // 初始化人员名字输入框
    initStaffNameInputs();
    
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
                
                // 重新生成日历和排班表
                generateCalendar(currentYear, currentMonth);
                const schedule = generateSchedule(currentYear, currentMonth);
                displaySchedule(schedule);
                generateStatistics(schedule);
            } else {
                console.error('获取节假日数据失败:', data.reason);
            }
        } catch (error) {
            console.error('获取节假日数据时出错:', error);
        }
    }
    
    // 初始化时获取节假日数据
    fetchHolidays();
    
    // 生成日历
    generateCalendar(currentYear, currentMonth);
    
    // 生成排班表
    const schedule = generateSchedule(currentYear, currentMonth);
    
    // 显示排班表
    displaySchedule(schedule);
    
    // 生成统计信息
    generateStatistics(schedule);
    
    /**
     * 生成日历
     * @param {number} year - 年份
     * @param {number} month - 月份（0-11）
     */
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
                eveningShifts: []
            };
        }
        
        // 为每一天分配人员
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dayOfWeek = date.getDay(); // 0-6，0表示星期日
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isSpecialDay = specialDates.includes(day);
            
            // 确定这一天需要多少人值班
            let requiredStaff;
            if (isWeekend || isSpecialDay) {
                requiredStaff = 4; // 周末和特殊日期需要4人值班
            } else {
                requiredStaff = 2; // 工作日至少2人值班
            }
            
            // 计算每个人已经休息的天数（本周内）
            const weekStart = day - dayOfWeek;
            const restCountThisWeek = {};
            
            for (const person of staff) {
                restCountThisWeek[person] = 0;
                
                // 计算本周内已休息的天数
                for (let d = Math.max(1, weekStart); d < day; d++) {
                    if (schedule[person].restDays.includes(d)) {
                        restCountThisWeek[person]++;
                    }
                }
            }
            
            // 确定谁应该休息
            const restingStaff = [];
            
            // 如果是周末或特殊日期，没有人休息
            if (!isWeekend && !isSpecialDay) {
                // 按照已休息天数排序（优先让休息天数少的人休息）
                const sortedStaff = [...staff].sort((a, b) => {
                    return restCountThisWeek[a] - restCountThisWeek[b];
                });
                
                // 选择休息的人员（确保每周休息2天）
                for (const person of sortedStaff) {
                    if (restingStaff.length >= staff.length - requiredStaff) {
                        break; // 已经有足够的人休息
                    }
                    
                    if (restCountThisWeek[person] < 2) {
                        restingStaff.push(person);
                    }
                }
            }
            
            // 更新排班表并分配早晚班
            // 计算每个人当前的早晚班次数，用于均衡分配
            const shiftCounts = {};
            for (const person of staff) {
                shiftCounts[person] = {
                    morning: schedule[person].morningShifts.length,
                    evening: schedule[person].eveningShifts.length
                };
            }
            
            // 按照早晚班次数排序（优先分配给班次少的人）
            const workingStaff = staff.filter(person => !restingStaff.includes(person));
            const morningStaff = [...workingStaff].sort((a, b) => {
                // 优先考虑早班次数，如果早班次数相同，则考虑总工作天数
                if (shiftCounts[a].morning !== shiftCounts[b].morning) {
                    return shiftCounts[a].morning - shiftCounts[b].morning;
                }
                return schedule[a].workDays.length - schedule[b].workDays.length;
            });
            
            // 确定早班人数（工作人员的一半，向上取整）
            const morningCount = Math.ceil(workingStaff.length / 2);
            
            // 分配早晚班
            for (const person of staff) {
                if (restingStaff.includes(person)) {
                    schedule[person].restDays.push(day);
                } else {
                    schedule[person].workDays.push(day);
                    
                    // 分配早晚班
                    if (morningStaff.indexOf(person) < morningCount) {
                        schedule[person].morningShifts.push(day);
                    } else {
                        schedule[person].eveningShifts.push(day);
                    }
                }
            }
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
            const isHoliday = holidays.holidays[currentMonth] && holidays.holidays[currentMonth].includes(day);
            const isWorkday = holidays.workdays[currentMonth] && holidays.workdays[currentMonth].includes(day);
            
            if (isHoliday) {
                dayElement.classList.add('holiday');
                
                // 添加节假日标记
                const holidayMarker = document.createElement('div');
                holidayMarker.className = 'holiday-marker';
                holidayMarker.textContent = '节';
                dayElement.querySelector('.day-number').appendChild(holidayMarker);
            } else if (isWorkday) {
                dayElement.classList.add('workday');
                
                // 添加补班日标记（使用与节假日相同的样式）
                const workdayMarker = document.createElement('div');
                workdayMarker.className = 'holiday-marker';
                workdayMarker.textContent = '班';
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
                        updateSchedule(this.dataset.person, parseInt(this.dataset.day), 'morning');
                    } else if (isMorning) {
                        this.classList.add('evening');
                        this.textContent = displayNames[this.dataset.person] + ' (晚)';
                        updateSchedule(this.dataset.person, parseInt(this.dataset.day), 'evening');
                    } else {
                        this.classList.add('rest');
                        this.textContent = displayNames[this.dataset.person] + ' (休)';
                        updateSchedule(this.dataset.person, parseInt(this.dataset.day), 'rest');
                    }
                });
                
                dayElement.appendChild(staffElement);
            }
        }
    }
    
    /**
     * 更新排班数据
     * @param {string} person - 人员
     * @param {number} day - 日期
     * @param {string} newStatus - 新状态（'rest'/'morning'/'evening'）
     */
    function updateSchedule(person, day, newStatus) {
        // 从原状态中移除
        const personSchedule = schedule[person];
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
        generateStatistics(schedule);
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
});