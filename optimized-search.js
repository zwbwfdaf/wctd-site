// 优化的搜索功能实现
(function() {
    // 立即添加搜索函数
    window.searchEarnings = function(keyword, options = {}) {
        console.log('执行收益搜索:', keyword, options);
        
        try {
            // 显示加载状态
            const earningsTable = document.querySelector('#all-earnings .card-body table tbody');
            if (earningsTable) {
                earningsTable.innerHTML = '<tr><td colspan="6" class="loading">搜索中...</td></tr>';
            }
            
            // 简化查询，避免复杂的JOIN和逻辑表达式
            let query = supabase.from('earnings').select('*, users(username)');
            
            // 添加基本过滤
            if (keyword && keyword.trim() !== '') {
                // 简单的单条件查询，避免复杂的逻辑表达式
                if (options.field === 'username') {
                    // 先获取匹配用户
                    supabase.from('users')
                        .select('id')
                        .ilike('username', `%${keyword}%`)
                        .then(({ data: users, error }) => {
                            if (error) {
                                console.error('搜索用户出错:', error);
                                if (earningsTable) {
                                    earningsTable.innerHTML = `<tr><td colspan="6" class="error">搜索出错: ${error.message}</td></tr>`;
                                }
                                return;
                            }
                            
                            if (users && users.length > 0) {
                                const userIds = users.map(user => user.id);
                                // 查询这些用户的收益
                                supabase.from('earnings')
                                    .select('*, users(username)')
                                    .in('user_id', userIds)
                                    .then(({ data, error }) => {
                                        if (error) {
                                            console.error('搜索收益出错:', error);
                                            if (earningsTable) {
                                                earningsTable.innerHTML = `<tr><td colspan="6" class="error">搜索出错: ${error.message}</td></tr>`;
                                            }
                                            return;
                                        }
                                        
                                        displayEarningsResults(data, keyword, options);
                                    });
                            } else {
                                // 没有找到匹配的用户
                                displayEarningsResults([], keyword, options);
                            }
                        });
                    return; // 提前返回，避免执行后面的代码
                } else if (options.field === 'id') {
                    query = query.ilike('id', `%${keyword}%`);
                } else if (options.field === 'task_name') {
                    query = query.ilike('task_name', `%${keyword}%`);
                } else {
                    // 默认搜索ID和任务名称
                    query = query.or(`id.ilike.%${keyword}%,task_name.ilike.%${keyword}%`);
                }
            }
            
            // 添加金额范围
            if (options.amountFrom && !isNaN(options.amountFrom)) {
                query = query.gte('amount', options.amountFrom);
            }
            
            if (options.amountTo && !isNaN(options.amountTo)) {
                query = query.lte('amount', options.amountTo);
            }
            
            // 添加日期范围
            if (options.dateFrom) {
                query = query.gte('created_at', options.dateFrom);
            }
            
            if (options.dateTo) {
                const endDate = new Date(options.dateTo);
                endDate.setHours(23, 59, 59);
                query = query.lte('created_at', endDate.toISOString());
            }
            
            // 执行查询
            query.then(({ data, error }) => {
                if (error) {
                    console.error('搜索收益记录时出错:', error);
                    if (earningsTable) {
                        earningsTable.innerHTML = `<tr><td colspan="6" class="error">搜索出错: ${error.message}</td></tr>`;
                    }
                    return;
                }
                
                displayEarningsResults(data, keyword, options);
            });
        } catch (error) {
            console.error('执行收益搜索时发生错误:', error);
            alert('搜索功能出错: ' + error.message);
        }
    };
    
    // 显示搜索结果的函数
    function displayEarningsResults(data, keyword, options) {
        // 获取表格元素
        const earningsTable = document.querySelector('#all-earnings .card-body table tbody');
        if (!earningsTable) {
            console.error('找不到收益表格元素');
            return;
        }
        
        // 清空表格
        earningsTable.innerHTML = '';
        
        // 如果没有数据
        if (!data || data.length === 0) {
            earningsTable.innerHTML = '<tr><td colspan="6" class="no-data">没有找到匹配的收益记录</td></tr>';
            return;
        }
        
        // 遍历数据，填充表格
        data.forEach(earning => {
            // 格式化金额
            const formattedAmount = parseFloat(earning.amount).toFixed(2);
            
            // 格式化创建时间
            const createdDate = new Date(earning.created_at);
            const formattedDate = `${createdDate.getFullYear()}/${(createdDate.getMonth() + 1).toString().padStart(2, '0')}/${createdDate.getDate().toString().padStart(2, '0')} ${createdDate.getHours().toString().padStart(2, '0')}:${createdDate.getMinutes().toString().padStart(2, '0')}:${createdDate.getSeconds().toString().padStart(2, '0')}`;
            
            // 获取用户名
            let username = '未知用户';
            if (earning.users && earning.users.username) {
                username = earning.users.username;
            }
            
            // 任务名称
            const taskName = earning.task_name || earning.description || earning.source || '未知任务';
            
            // 获取状态
            const status = earning.status || '已完成';
            
            // 创建表格行
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${earning.id}</td>
                <td>${username}</td>
                <td>${taskName}</td>
                <td>¥${formattedAmount}</td>
                <td>${formattedDate}</td>
                <td>${status}</td>
                <td>
                    <button class="btn-edit" data-id="${earning.id}">编辑</button>
                    <button class="btn-delete" data-id="${earning.id}">删除</button>
                </td>
            `;
            
            earningsTable.appendChild(row);
        });
        
        // 绑定按钮事件
        const editButtons = document.querySelectorAll('#all-earnings .btn-edit');
        const deleteButtons = document.querySelectorAll('#all-earnings .btn-delete');
        
        editButtons.forEach(button => {
            button.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                console.log('编辑收益:', id);
                // 调用编辑函数，如果存在
                if (typeof window.editEarning === 'function') {
                    window.editEarning(id);
                }
            });
        });
        
        deleteButtons.forEach(button => {
            button.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                console.log('删除收益:', id);
                // 调用删除函数，如果存在
                if (typeof window.deleteEarning === 'function') {
                    window.deleteEarning(id);
                }
            });
        });
    }
    
    // 添加到全局对象
    window.displayEarningsResults = displayEarningsResults;
    
    console.log('优化的搜索功能已加载');
})();

