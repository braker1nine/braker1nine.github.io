(function () {

	function Quill(options) {
		var self = this;
		self.items = new Blaze.Var({});
		self.listeners = {};

		this.socket = io.connect('http://' + window.location.hostname + ':3001');
		this.socket.on('init', function(data) {

			function mapVar(item, key, list) {
				var item = new Blaze.Var(item);
				var items = self.items.get();
				items[item.get().id] = item;
				self.items.set(items);
				return item;
			}

			_.each(data.drafts, mapVar);
			_.each(data.published, mapVar);
			_.each(data.queue, mapVar);
			_.each(data.pages, mapVar);
		});

		this.socket.on('post/created', function(post) {
			self._addPost(post);
		});

		this.socket.on('post/deleted', function(post) {
			var items = this.items.get();
			delete items[post.id];
			this.items.set(items);
		});

		this.socket.on('post/updated', function(post) {
			self._itemChanged(post);
		})


		this.socket.on('page/created', function(post) {
			//self._addPost(post);

		});

		this.socket.on('page/deleted', function(post) {
			var items = this.items.get();
			delete items[post.id];
			this.items.set(items);
		});

		this.socket.on('page/updated', function(post) {
			self._itemChanged(post);
		})

	}

	Quill.prototype._removePost = function(post) {
		var id = (typeof post == "object" ? post.id : post);
		var items = this.items.get();
		delete items[id];
		this.items.set(items);
	};

	Quill.prototype._addPost = function(post) {
		var items = this.items.get();
		if (items[post.id]) {
			items[post.id].set(post);
		} else {
			items[post.id] = new Blaze.Var(post);
		}
		this.items.set(items);
	}

	Quill.prototype.on = function(type, func) {
		if (!this.listeners[type]) {
			this.listeners[type] = [func];
		} else if (this.listeners[type].indexOf(func) < 0) {
			this.listeners[type].push(func);
		}
	}

	Quill.prototype.off = function(type, func) {
		var typeArray = this.listeners[type];
		if (typeArray) {
			var idx = typeArray.indexOf(func);
			if (idx >= 0) {
				typeArray.splice(idx, 1)
			}
		}
	}

	Quill.prototype.emit = function(type, data) {
		var typeArray = this.listeners[type];
		if (typeArray) {
			for (var i = 0; i < typeArray.length; i++) {
				typeArray[i](data)
			};
		}
	}

	Quill.prototype.draft = function(limit) {
		return this.getItems({type:'post', status:'draft'}, function(item) { 
			return (item.get().details.title || ''); });
	}

	Quill.prototype.queue = function(limit) {
		return this.getItems({type:'post', status:'queue'}, function(item) { 
			return item.get().details.queue || 100000; });
	}

	Quill.prototype.published = function(limit) {
		return this.getItems({type:'post', status:'published'}, function(item) { 
			return -(new Date(item.get().details.date).getTime());});
	}

	Quill.prototype.getItems = function(params, sortFunc) {
		params = params || {};

		var res = [];
		for (var key in this.items.get()) {
			var item = this.items.get()[key];
			var add = true;
			add = add && (!params.type || item.get().type == params.type);
			add = add && (!params.status || item.get().status == params.status);
			if (add) {
				res.push(item);
			}
		}
		// Sort items
		if (typeof sortFunc == 'function') { res = _.sortBy(res, sortFunc); }

		return res;
	}

	Quill.prototype.getPublished = function (limit) {
		return fetchData('published')
	}

	Quill.prototype.getDrafts = function (limit) {
		return fetchData('drafts');
	}

	Quill.prototype.getQueue = function (limit) {
		return fetchData('queue');
	}	

	Quill.prototype.getEntriesOfType = function (type, limit) {
		return fetchData(type);
	}

	Quill.prototype.queuePost = function(post, callback) {
		this.socket.emit('queue', post, function(queued) {
			if (callback) callback(queued)
		})
	}

	Quill.prototype.dequeuePost = function(post, callback) {
		this.socket.emit('queue/dequeue', post, function(post) {
			if (callback) callback(post);
		})
	}

	Quill.prototype.createDraft = function(post, callback) {
		this.socket.emit('drafts/create', post, function(err, res) {
			if (!err) {
				this._addPost(res);
			}
			if (typeof callback == 'function') callback(err, res);
		}.bind(this));
	}

	Quill.prototype.save = function(post, callback) {
		this.socket.emit('save', this._postToJSON(post), function(err, post) {
			this._itemChanged(post)
			if (typeof callback == 'function') callback(err, post);
		}.bind(this))
	}

	Quill.prototype.deletePost = function(post, callback) {
		this.socket.emit('deleteEntry', post.id, function(err, res) {
			if (!err && res) {
				this._removePost(post);
			}
			if (typeof callback == 'function') callback(err, res);
		}.bind(this));
	}

	/* Page Management */
	Quill.prototype.createPage = function(page, callback) {
		this.socket.emit('pages/create', page, function(err, page) {
			if (!err) {
				this._addPost(page);
			}
			if (typeof callback == 'function') callback(err, page);
		}.bind(this))
	}

	Quill.prototype.publishPage = function(page, callback) {
		this.socket.emit('pages/publish', page, function(err, page) {
			if (typeof callback == 'function') callback(err, page);
		})
	};


	/* Generic post/page management */
	Quill.prototype.publish = function(item, callback) {
		this.socket.emit('publish', this._postToJSON(item), function(err, res) {
			if (err) {
				return;
			}

			res = this._itemChanged(res)
			
			if (typeof callback == 'function') callback(err, res);
		}.bind(this))
	};

	Quill.prototype.unpublish = function(item, callback) {
		this.socket.emit('unpublish', this._postToJSON(item), function(err, res) {
			res = this._itemChanged(res);
			if (typeof callback == 'function') callback(err, res);
		}.bind(this));
	};

	Quill.prototype.preview = function(item, callback) {
		this.socket.emit('preview', this._postToJSON(item), function(err, res) {
			if (typeof callback == 'function') callback(err, res);
		})
	}

	Quill.prototype._itemChanged = function(item) {
		var original = this.items.get()[item.id];
		var originalObject = original.get();
		var originalType, originalStatus;

		if (original) {
			originalStatus = originalObject.status;
			originalType = originalObject.type;

			_.extend(originalObject, item);
			original.set(originalObject);
		} else {
			var items = this.items.get()
			items[item.id] = new Blaze.Var(item);
			this.items.set(items)
		}


		var newItem = this.items.get()[item.id];

		return newItem;
	}

	Quill.prototype._postToJSON = function(post) {
		var post = _.clone(post);
		return post;
	}


	/* Image Management */
	Quill.prototype.getImages = function(callback) {
		fetchData('images').then(function(images) {
			callback(images)
		})
	}

	Quill.prototype.uploadImage = function(file, callback) {
		uploadFile('images/upload', file, function() {
			callback()	
		})
	}

	Quill.prototype.getItem = function(id) {
		return this.items.get()[id];
	}

	function fetchData(path, parameters) {
		return new Promise(function(resolve, reject) {
			$.get('/api/' + path, function(data, textStatus, xhr) {
				resolve(data)
			}.bind(this));
		})
	}

	function postData(path, data) {
		return new Promise(function(resolve, reject) {
			$.post('/api/'+path, data, function(response, textStatus, xhr) {
				resolve(response)
			});
		});
	}

	function uploadFile(path, file, callback) 
	{
		var client = new XMLHttpRequest();
		client.open("post", "/api/"+path, true);
		client.setRequestHeader("Content-Type", "multipart/form-data");

		client.onreadystatechange = function() {
			if (client.readyState == 4 && client.status == 200) {
				callback()
			}
		}
		client.send(file);  /* Send to server */ 
	}

	window.API = new Quill();

}(window));