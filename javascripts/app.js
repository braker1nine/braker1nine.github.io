/* Registering Helpers */
UI.registerHelper('isPage', function(item) {
	return item.type == 'page';
})

UI.registerHelper('isPost', function(item) {
	return item.type == 'post';
})

UI.registerHelper('isPublished', function(item) {
	return item.status == 'published';
})

UI.registerHelper('isDraft', function(item) {
	return item.status == 'draft';
})

UI.registerHelper('isQueue', function(item) {
	return item.status == 'queue';
})

Clive = {
	view: new Blaze.Var('Posts'),
	subview: new Blaze.Var('draft'),
	images: new Blaze.Var([]),
	showImages: new Blaze.Var(false),
	previewPost: new Blaze.Var(null),
	currentPostId: new Blaze.Var(null),
	currentPost: function() {
		var item = API.getItem(Clive.currentPostId.get());
		if (!item) {
			Clive.currentPostId.set(null);
		}
		return item;
	},
	changed: new Blaze.Var(false),
	previousVersion: new Blaze.Var(''),
	draft: new Blaze.Var([]),
	queue: new Blaze.Var([]),
	published: new Blaze.Var([]),
	pages: new Blaze.Var([]),
	API: API,
	updatePostText: function(text, start, end) {
		var currentPost = Clive.currentPost();
		var postObj = currentPost.get();
		if (!currentPost) return;
		var state = {};
		var previousVersion = Clive.previousVersion.get()

		/* If this is the first edit, save the previous version for resetting */
		if (!previousVersion) { 
			previousVersion = postObj.text;
		}

		postObj.text = text;
		currentPost.set(postObj)
		Clive.changed.set(true)
		Clive.previousVersion.set(previousVersion);

		Deps.flush();
		var editor = $('textarea#editor').get(0)
		editor.focus();
		if (typeof start != "undefined" && typeof end != "undefined") {
			editor.selectionStart = start;
			editor.selectionEnd = end;
		}
	},
};

Template.main.helpers({
	isView: function(name) {
		return Clive.view.get() == name;
	},
	showPreview: function() {
		return Clive.previewPost.get() != null
	}
})

Template.main.events({
	'click #preview':function(e) {
		Clive.previewPost.set(null);
	}
})

Template.Navigation.helpers({
	items: function() {
		return ['Posts', 'Pages', 'Settings'];
	}
});
 
Template.NavigationLink.helpers({
	active: function() {
		var view = Clive.view.get();
		return (view == this.toString() ? 'active':'');
	},
	icon: function() {
		return {
			Posts:'edit',
			Pages:'file-o',
			Settings:'gear'
		}[this.toString()]
	}
})

Template.NavigationLink.events({
	'click': function(e) {
		if (Clive.view.get() != this.toString()) {
			Clive.view.set(this.toString())
		}
	}
})


Template.PostList.helpers({
	postTypes: function() {
		return ['draft', 'queue', 'published'];
	},
	activeType: function() {
		return (Clive.subview.get() == this.toString() ? 'active' : '');
	},
	noItems: function() {
		var subview = Clive.subview.get();
		var items = API[subview]();
		return !items.length;
	},
	postItems: function() {
		var subview = Clive.subview.get();
		var posts = API[subview]();
		return posts;
	}
});

Template.PostList.events({
	'click .postList__typeSelector li:not(.active)': function(e) {
		Clive.subview.set(this.toString());
	},
	'click .button.createDraft': function() {
		var newPost = {details:{}, content:'', type:'post', status:'draft'};
		API.createDraft(newPost, function(err, res) {
			Clive.subview.set('draft');
			Clive.currentPostId.set(res.id)
		}.bind(this))
	}
})

Template.PostListItem.helpers({
	classes: function() {
		var classes = 'postList__postItems__post post_type_'+this.type + ' post_status_' + this.status;
		var currentPostId = Clive.currentPostId.get();
		if (currentPostId && currentPostId == this.get().id) {
			classes += ' selected';
		}
		return classes;
	},
	noTitle: function() {
		return !(this.get().details.title)
	},
	title: function() {
		return (this.get().details.title ? 
			this.get().details.title : 
			'Untitled');
	},
	noBody: function() {
		return !(this.get().text);
	},
	body: function() {
		return this.get().text ? this.get().text : 'No content';
	}
});

Template.PostListItem.events({
	'click *': function() {
		Clive.currentPostId.set(this.get().id);
	}
})

Template.PageList.helpers({
	noItems: function() {
		var items = API.getItems({type:'page'});
		return items.length == 0;
	},
	items: function() {
		var items = API.getItems({type:'page'});
		return items;
	}
})

Template.PageList.events({
	'click .createButton': function() {
		var newPost = {details:{}, content:'', type:'page', status:'draft'};
		API.createPage(newPost, function(err, res) {
			Clive.currentPostId.set(res.id)
		}.bind(this))
	}
})

Template.Editor.helpers({
	editorClasses: function() {
		var post = Clive.currentPost()
		var classes = 'editorContainer';
		if (post && post.get()) {
			classes += ' ' + post.get().type + ' ' + post.get().status;
		}
		return classes;
	},
	noPost: function() {
		var post = Clive.currentPostId.get();
		return !post;
	},

	currentPost: function() {
		return Clive.currentPost().get();
	},

	postDate: function() {
		return moment(this.details.date).format('MMMM Do YYYY, h:mm:ss a');
	},
	isPublished: function() {
		return this.status == 'published';
	},
	isPost: function() {
		return this.type == 'post';
	},

})

Template.Editor.events({
	'keyup input[type="text"]':function(e) {
		var currentPost = Clive.currentPost().get()
		currentPost.details[e.target.dataset.detail] = e.target.value;
		Clive.currentPost().set(currentPost);
		Clive.changed.set(true);	
	},
	'keyup textarea#editor': function(e) {
		Clive.updatePostText(e.target.value)
	}
})

Template.EditorButtons.helpers({
	noChange: function() {
		return !Clive.changed.get();
	},
})

Template.EditorButtons.events({
	'click .saveButton:not(.disabled)':function(e) {
		if (this.status == 'creating') {
			if (this.type == 'post') {

				this.status = 'draft';
				API.createDraft(this, function(post) {
					//Clive.currentPost().set(post);
					Clive.changed.set(false);
					Clive.previousVersion.set('')
				}.bind(this));
			} else if (this.type == 'page') {

				this.status = 'draft';
				API.createPage(this, function(page) {
					//Clive.currentPost().set(post);
					Clive.changed.set(false);
					Clive.previousVersion.set('')
				});
			}
		} else {
			API.save(this, function(err, post) {
				//Clive.currentPost().set(post);
				Clive.changed.set(false);
				Clive.previousVersion.set('')
			}.bind(this));
		}
	},
	'click .resetButton:not(.disabled)': function(evt, tmpl) {
		var post = this;
		post.text = Clive.previousVersion.get();
		Clive.currentPost().set(post);
		Clive.changed.set(false);
		Clive.previousVersion.set('');
		$('textarea#editor').val(post.text);
	},

	'click .previewButton':function(evt, tmpl) {
		Clive.previewPost.set(this);
		API.preview(this, function(err, res) {
			var iframe = document.createElement('IFRAME');
			$('#preview').empty().append(iframe);
			iframe.contentWindow.document.write(res);
		})
	},

	'click .queueButton': function() {
		API.queuePost(this, function(queued) {
			//Clive.currentPostId.set(null);
			Clive.changed.set(false);
			Clive.previousVersion.set('')
		}.bind(this));
	},

	'click .dequeueButton': function() {
		API.dequeuePost(this, function(err, post) {
			//Clive.currentPostId.set(null);
			Clive.changed.set(false);
			Clive.previousVersion.set('')
		}.bind(this));
	},
	'click .deleteButton': function(evt) {
		API.deletePost(this, function(err, id) {
			if (err) {

			} else {
				Clive.currentPostId.set(null);
				Clive.changed.set(false);
				Clive.previousVersion.set('')
			}
		}.bind(this));
	},
	'click .publishButton': function() {
		API.publish(this, function(err, res) {
			if (err) {

			} else {
				//Clive.currentPost().set(res);
				Clive.changed.set(false);
				Clive.previousVersion.set('')
			}
		})
	},
	'click .unpublishButton': function() {
		API.unpublish(this, function(err, res) {
			if (err) {

			} else {
				//Clive.currentPost.set(res);
				Clive.changed.set(false);
				Clive.previousVersion.set('')
			}
		})
	},
})

Template.WordCount.count = function() {
	return ((this.text || '').match(/\S+/g) || []).length;
}

Template.CharacterCount.count = function() {
	return (this.text || '').length;
}




Template.BottomButtons.events({

	'click .boldButton': function(e, tmpl) {
		var editorEl = $('textarea#editor')[0];
		var start 	= editorEl.selectionStart,
			end 	= editorEl.selectionEnd;

		var selectedText = editorEl.value.slice(editorEl.selectionStart, editorEl.selectionEnd);
		var text = editorEl.value.slice(0, editorEl.selectionStart) + '**'+selectedText+'**' + editorEl.value.slice(editorEl.selectionEnd);

		Clive.updatePostText(text, start+2, end+2);
	},

	'click .italicButton': function(e, tmpl) {
		var editorEl = $('textarea#editor')[0];
		var start 	= editorEl.selectionStart,
			end 	= editorEl.selectionEnd;

		var selectedText = editorEl.value.slice(editorEl.selectionStart, editorEl.selectionEnd);
		var text = editorEl.value.slice(0, editorEl.selectionStart) + '*'+selectedText+'*' + editorEl.value.slice(editorEl.selectionEnd);

		Clive.updatePostText(text, start+1, end+1);
	},

	'click .codeButton': function(e, tmpl) {
		var editorEl = $('textarea#editor')[0];
		var start 	= editorEl.selectionStart,
			end 	= editorEl.selectionEnd;

		var selectedText = editorEl.value.slice(editorEl.selectionStart, editorEl.selectionEnd);
		var text = editorEl.value.slice(0, editorEl.selectionStart) + '\n``\n'+selectedText+'\n``\n' + editorEl.value.slice(editorEl.selectionEnd);

		Clive.updatePostText(text, start + 4, end + 4);
	},

	'click .linkButton': function(e, tmpl) {
		var editorEl = $('textarea#editor')[0];
		var start 	= editorEl.selectionStart,
			end 	= editorEl.selectionEnd;

		var selectedText = editorEl.value.slice(editorEl.selectionStart, editorEl.selectionEnd) || 'Link text';
		var text = editorEl.value.slice(0, editorEl.selectionStart) + '['+selectedText+'](Link)' + editorEl.value.slice(editorEl.selectionEnd);

		Clive.updatePostText(text, start + 1, start + selectedText.length+1);
	},

	'click .imagesButton': function() {
		var opacity = 1;
		var translateX = '-200px';
		var hiding = Clive.showImages.get();

		if (hiding) {
			//opacity = 0;
			translateX = '0px';
		}
		
		Clive.showImages.set(!hiding);

		if (hiding) {
			$('.imagesContainer').velocity({translateX:'-205px'}, {duration:50}).velocity({translateX:'0'}, {duration:300});
		} else {
			$('.imagesContainer').velocity({opacity:opacity, translateX:[translateX,[300,20]]}, {duration:350});
		}
	},

})

Template.Images.created == function() {
	API.getImages(function(images) {
		Clive.images.set(images);
	}.bind(this))
}

Template.Images.helpers({
	hideImages: function() {

	}
});

Template.Images.events({
	'click .addImageButton': function(e) {
		e.preventDefault();
		var formData = new FormData();
		var file = $(e.target).siblings('input')[0].files[0];
		formData.append('image', file, file.name)

		var xhr = new XMLHttpRequest();
		xhr.open('POST', '/api/images/upload', true);
		xhr.onload = function() {
			if (xhr.status === 200) {
				console.log('UPLOADED');
				API.getImages(function(images) {
					this._owner._owner.setState({images:images})
				}.bind(this))
			} else {
				console.error('FAILED')
			}
		}.bind(this)
		xhr.send(formData)
		/*API.uploadImage(formData, function() {
			console.log('UPLOADED')
		})*/
	}
});

Template.ImageItem.events({
	'click .imageInsertButton': function(e) {
		var editorEl = $('textarea#editor')[0];
		var imageText = '![Alt Text](' + this.props.image.file + ')';
		var text = editorEl.value.slice(0, editorEl.selectionStart) + imageText + editorEl.value.slice(editorEl.selectionEnd);

		Clive.updatePostText(text);

		// There's probably a more React way to do this, but I want to select the alt text
		window.setTimeout(function() {
			editorEl.selectionStart = editorEl.selectionStart+2;
			editorEl.selectionEnd = editorEl.selectionStart+8;
		}, 50)
	}
})